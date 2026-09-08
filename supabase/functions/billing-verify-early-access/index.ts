// @ts-expect-error Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error Deno imports
import { createClient } from "npm:@supabase/supabase-js";

declare const Deno: { env: { get(key: string): string | undefined } };

import { CashfreeApiError, getCashfreeOrder, getCashfreePaymentsForOrder, validateCashfreeEarlyAccessEvidence } from "../_shared/cashfree.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { EARLY_ACCESS, inrAmountToPaise } from "../_shared/early-access.ts";
import { verifyClerkToken } from "../_shared/clerk.ts";

const ORDER_ID_PATTERN = /^ea_[a-f0-9]{32}$/;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED", message: "Method not allowed." }, 405);

  const requestId = `cashfree_verify_${crypto.randomUUID()}`;
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, code: "AUTH_REQUIRED", message: "Authentication required.", requestId }, 401);
    }
    const workspaceId = await verifyClerkToken(req, authHeader.slice(7));
    const body = await req.json().catch(() => null) as { orderId?: unknown } | null;
    const orderId = typeof body?.orderId === "string" && ORDER_ID_PATTERN.test(body.orderId) ? body.orderId : null;
    if (!orderId) return json({ ok: false, code: "INVALID_ORDER_ID", message: "A valid Cashfree order ID is required.", requestId }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
    const { data: localPayment, error: paymentError } = await admin
      .from("billing_payments")
      .select("id, workspace_id, provider_order_id, amount_paise, currency, status")
      .eq("workspace_id", workspaceId)
      .eq("provider", "cashfree")
      .eq("provider_order_id", orderId)
      .eq("payment_type", EARLY_ACCESS.paymentType)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!localPayment) return json({ ok: false, code: "PAYMENT_NOT_FOUND", message: "This order does not belong to the signed-in account.", requestId }, 404);

    if (localPayment.status === "paid") {
      return json({ ok: true, active: true, alreadyProcessed: true, requestId });
    }
    if (Number(localPayment.amount_paise) !== EARLY_ACCESS.totalPaise || localPayment.currency !== EARLY_ACCESS.currency) {
      throw new Error("LOCAL_PAYMENT_EVIDENCE_MISMATCH");
    }

    const [order, payments] = await Promise.all([
      getCashfreeOrder(orderId, requestId),
      getCashfreePaymentsForOrder(orderId, requestId),
    ]);
    const evidence = validateCashfreeEarlyAccessEvidence(order, payments, {
      orderId,
      workspaceId,
      internalPaymentId: localPayment.id,
      amountPaise: EARLY_ACCESS.totalPaise,
      currency: EARLY_ACCESS.currency,
      paymentType: EARLY_ACCESS.paymentType,
    }, inrAmountToPaise);
    console.log(`[${requestId}] cashfree_verification_state`, localPayment.id, workspaceId, orderId, evidence.state);

    if (evidence.state === "paid" && evidence.paymentId && evidence.paidAt) {
      const { data: result, error: finalizeError } = await admin.rpc("finalize_early_access_purchase", {
        p_workspace_id: workspaceId,
        p_provider: "cashfree",
        p_order_id: orderId,
        p_payment_id: evidence.paymentId,
        p_paid_at: evidence.paidAt,
      });
      if (finalizeError) {
        console.error(`[${requestId}] cashfree_provisioning_failed`, localPayment.id, workspaceId, orderId, finalizeError.message);
        return json({
          ok: false,
          code: "ACCESS_PROVISIONING_FAILED",
          message: "Payment was received, but access provisioning is delayed. Retry verification; do not pay again.",
          requestId,
        }, 503);
      }
      console.log(`[${requestId}] cashfree_early_access_finalized`, workspaceId, orderId, evidence.paymentId);
      return json({ ok: true, active: true, ...result, requestId });
    }

    if (evidence.state === "pending") {
      await admin.from("billing_payments").update({ status: "pending" }).eq("id", localPayment.id).neq("status", "paid");
      return json({ ok: true, active: false, processing: true, status: "pending", message: "Cashfree is still confirming this payment.", requestId }, 202);
    }

    const providerOrderStillPayable = order.order_status === "ACTIVE";
    await admin.from("billing_payments").update({
      status: providerOrderStillPayable ? "active" : evidence.state,
      failed_at: providerOrderStillPayable ? null : new Date().toISOString(),
    }).eq("id", localPayment.id).neq("status", "paid");
    const cancelled = evidence.state === "cancelled" || evidence.state === "user_dropped";
    return json({
      ok: false,
      active: false,
      code: cancelled ? "PAYMENT_CANCELLED" : "PAYMENT_FAILED",
      status: evidence.state,
      message: cancelled ? "Cashfree checkout was cancelled. No access or credits were applied." : "The payment was not successful. No access or credits were applied.",
      requestId,
    }, 409);
  } catch (error: unknown) {
    if (error instanceof CashfreeApiError) {
      console.error(`[${requestId}] cashfree_verify_provider_error`, error.status, error.code, error.errorType);
    } else {
      console.error(`[${requestId}] cashfree_verify_error`, error instanceof Error ? error.message : String(error));
    }
    const mismatch = error instanceof Error && error.message.includes("EVIDENCE_MISMATCH");
    return json({
      ok: false,
      code: mismatch ? "PAYMENT_EVIDENCE_MISMATCH" : "VERIFICATION_UNAVAILABLE",
      message: mismatch ? "Cashfree payment details did not match this purchase." : "Payment verification is temporarily unavailable. Please retry; do not pay again.",
      requestId,
    }, mismatch ? 409 : 503);
  }
});
