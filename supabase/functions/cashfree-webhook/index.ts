// @ts-expect-error Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error Deno imports
import { createClient } from "npm:@supabase/supabase-js";

declare const Deno: { env: { get(key: string): string | undefined } };

import {
  getCashfreeOrder,
  getCashfreePaymentsForOrder,
  validateCashfreeEarlyAccessEvidence,
  verifyCashfreeWebhookSignature,
} from "../_shared/cashfree.ts";
import { EARLY_ACCESS, inrAmountToPaise } from "../_shared/early-access.ts";

const SUPPORTED_EVENTS = new Set([
  "PAYMENT_SUCCESS_WEBHOOK",
  "PAYMENT_FAILED_WEBHOOK",
  "PAYMENT_USER_DROPPED_WEBHOOK",
]);

type CashfreeWebhook = {
  type?: string;
  event_time?: string;
  data?: {
    order?: { order_id?: string };
    payment?: { cf_payment_id?: string | number };
  };
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

serve(async (req: Request) => {
  if (req.method !== "POST") return json({ received: false, message: "Method not allowed." }, 405);

  const requestId = `cashfree_webhook_${crypto.randomUUID()}`;
  let eventId: string | null = null;
  let admin: ReturnType<typeof createClient> | null = null;
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-webhook-signature");
    const timestamp = req.headers.get("x-webhook-timestamp");
    if (!signature || !timestamp) return json({ received: false, message: "Missing Cashfree signature headers." }, 400);

    const validSignature = await verifyCashfreeWebhookSignature(rawBody, timestamp, signature);
    if (!validSignature) return json({ received: false, message: "Invalid Cashfree signature." }, 401);

    const event = JSON.parse(rawBody) as CashfreeWebhook;
    const type = event.type;
    const orderId = event.data?.order?.order_id;
    if (!type || !orderId) return json({ received: false, message: "Invalid Cashfree webhook payload." }, 400);

    const suppliedEventId = req.headers.get("x-idempotency-key");
    eventId = `cashfree:${suppliedEventId || await sha256(rawBody)}`;
    admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: existingEvent } = await admin
      .from("billing_webhook_events")
      .select("id, processing_status")
      .eq("provider_event_id", eventId)
      .maybeSingle();
    if (existingEvent?.processing_status === "processed") {
      return json({ received: true, duplicate: true });
    }
    if (!existingEvent) {
      const { error: eventInsertError } = await admin.from("billing_webhook_events").insert({
        provider: "cashfree",
        provider_event_id: eventId,
        event_type: type,
        payment_id: event.data?.payment?.cf_payment_id ? String(event.data.payment.cf_payment_id) : null,
        payload_json: event,
        processing_status: "pending",
      });
      if (eventInsertError && eventInsertError.code !== "23505") throw eventInsertError;
    }

    if (!SUPPORTED_EVENTS.has(type)) {
      await admin.from("billing_webhook_events").update({ processing_status: "processed", processed_at: new Date().toISOString() }).eq("provider_event_id", eventId);
      return json({ received: true, ignored: true });
    }

    const { data: localPayment, error: paymentError } = await admin
      .from("billing_payments")
      .select("id, workspace_id, amount_paise, currency, status")
      .eq("provider", "cashfree")
      .eq("provider_order_id", orderId)
      .eq("payment_type", EARLY_ACCESS.paymentType)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!localPayment) {
      await admin.from("billing_webhook_events").update({ processing_status: "processed", processed_at: new Date().toISOString() }).eq("provider_event_id", eventId);
      return json({ received: true, ignored: true });
    }
    if (!localPayment.amount_paise || Number(localPayment.amount_paise) <= 0 || !localPayment.currency) {
      throw new Error("LOCAL_PAYMENT_EVIDENCE_MISMATCH");
    }

    // The signed webhook is a trigger, never the authority for fulfillment.
    // Re-fetch both provider resources before applying access or credits.
    const [order, payments] = await Promise.all([
      getCashfreeOrder(orderId, requestId),
      getCashfreePaymentsForOrder(orderId, requestId),
    ]);
    const evidence = validateCashfreeEarlyAccessEvidence(order, payments, {
      orderId,
      workspaceId: localPayment.workspace_id,
      internalPaymentId: localPayment.id,
      amountPaise: Number(localPayment.amount_paise),
      currency: localPayment.currency,
      paymentType: EARLY_ACCESS.paymentType,
    }, inrAmountToPaise);
    console.log(`[${requestId}] cashfree_webhook_state`, localPayment.id, localPayment.workspace_id, orderId, evidence.state);

    if (evidence.state === "paid" && evidence.paymentId && evidence.paidAt) {
      const { error: finalizeError } = await admin.rpc("finalize_early_access_purchase", {
        p_workspace_id: localPayment.workspace_id,
        p_provider: "cashfree",
        p_order_id: orderId,
        p_payment_id: evidence.paymentId,
        p_paid_at: evidence.paidAt,
      });
      if (finalizeError) throw finalizeError;
      console.log(`[${requestId}] cashfree_webhook_finalized`, localPayment.workspace_id, orderId, evidence.paymentId);
    } else if (evidence.state === "pending") {
      await admin.from("billing_payments").update({ status: "pending" }).eq("id", localPayment.id).neq("status", "paid");
    } else {
      const providerOrderStillPayable = order.order_status === "ACTIVE";
      await admin.from("billing_payments").update({
        status: providerOrderStillPayable ? "active" : evidence.state,
        failed_at: providerOrderStillPayable ? null : new Date().toISOString(),
      }).eq("id", localPayment.id).neq("status", "paid");
    }

    await admin.from("billing_webhook_events").update({
      processing_status: "processed",
      processed_at: new Date().toISOString(),
      error_message: null,
    }).eq("provider_event_id", eventId);
    return json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${requestId}] cashfree_webhook_error`, message);
    if (admin && eventId) {
      await admin.from("billing_webhook_events").update({ processing_status: "failed", error_message: message.slice(0, 500) }).eq("provider_event_id", eventId);
    }
    return json({ received: false, message: "Webhook reconciliation failed." }, 500);
  }
});
