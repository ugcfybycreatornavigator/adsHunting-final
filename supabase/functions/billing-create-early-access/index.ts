// @ts-expect-error Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error Deno imports
import { createClient } from "npm:@supabase/supabase-js";

declare const Deno: { env: { get(key: string): string | undefined } };

import { EARLY_ACCESS, inrAmountToPaise } from "../_shared/early-access.ts";
import { CashfreeApiError, type CashfreeOrder, createCashfreeOrder, getCashfreeConfig, getCashfreeOrder } from "../_shared/cashfree.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { verifyClerkToken } from "../_shared/clerk.ts";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(value: unknown) {
  if (typeof value !== "string") return null;
  const phone = value.replace(/[\s()-]/g, "");
  const match = phone.match(/(\d{10})$/);
  return match ? match[1] : null;
}

function getAppBaseUrl() {
  const value = Deno.env.get("APP_BASE_URL");
  if (!value) throw new Error("APP_BASE_URL is not configured.");
  
  let url: URL;
  try {
    url = new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    throw new Error("APP_BASE_URL is not a valid URL.");
  }

  if (getCashfreeConfig().environment === "production" && url.protocol !== "https:") {
    throw new Error("APP_BASE_URL must use HTTPS in production.");
  }
  return url.toString().replace(/\/$/, "");
}

function orderMatchesIntent(order: CashfreeOrder, orderId: string, workspaceId: string, paymentId: string) {
  return order.order_id === orderId
    && inrAmountToPaise(order.order_amount) === EARLY_ACCESS.totalPaise
    && order.order_currency === EARLY_ACCESS.currency
    && order.customer_details?.customer_id === workspaceId
    && order.order_tags?.product === EARLY_ACCESS.paymentType
    && order.order_tags?.workspace_id === workspaceId
    && order.order_tags?.internal_payment_id === paymentId;
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED", message: "Method not allowed." }, 405);

  const requestId = `cashfree_create_${crypto.randomUUID()}`;
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, code: "AUTH_REQUIRED", message: "Authentication required.", requestId }, 401);
    }
    const userId = await verifyClerkToken(req, authHeader.slice(7));
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const customerPhone = normalizePhone(body?.customerPhone);
    if (!customerPhone) {
      return json({ ok: false, code: "PHONE_REQUIRED", message: "Enter a valid phone number to continue with Cashfree checkout.", requestId }, 400);
    }

    const cashfreeConfig = getCashfreeConfig();
    const appBaseUrl = getAppBaseUrl();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("SUPABASE_URL is not configured.");
    const admin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { error: profileSetupError } = await admin.from("profiles").upsert(
      { id: userId, clerk_user_id: userId },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (profileSetupError) {
      console.error(`[${requestId}] workspace_profile_failed`, profileSetupError.message);
      return json({ ok: false, code: "WORKSPACE_SETUP_FAILED", message: "Your account is still being prepared. Please try again shortly.", requestId }, 503);
    }

    const [{ data: profile }, { data: existingGrant }, { data: existingPayment }, { data: activeSubscription }] = await Promise.all([
      admin.from("profiles").select("email, full_name").eq("id", userId).maybeSingle(),
      admin.from("billing_access_grants").select("id").eq("workspace_id", userId).eq("grant_type", EARLY_ACCESS.paymentType).maybeSingle(),
      admin.from("billing_payments").select("id, provider_order_id, status, amount_paise, currency").eq("workspace_id", userId).eq("provider", "cashfree").eq("payment_type", EARLY_ACCESS.paymentType).in("status", ["creating", "active", "attempted", "pending", "paid"]).maybeSingle(),
      admin.from("billing_subscriptions").select("id, status, current_period_end").eq("workspace_id", userId).maybeSingle(),
    ]);

    const subscriptionStillActive = activeSubscription
      && (activeSubscription.status === "active"
        || activeSubscription.status === "trialing"
        || (activeSubscription.status === "cancelled" && activeSubscription.current_period_end && new Date(activeSubscription.current_period_end) > new Date()));
    if (subscriptionStillActive) return json({ ok: false, code: "ACCOUNT_ALREADY_HAS_ACCESS", message: "This account already has active AdsHunting access.", requestId }, 409);
    if (existingGrant || existingPayment?.status === "paid") return json({ ok: false, code: "EARLY_ACCESS_ALREADY_ACTIVE", message: "Early Access is already active for this account.", requestId }, 409);
    if (!profile?.email) return json({ ok: false, code: "EMAIL_REQUIRED", message: "Add an email address to your AdsHunting account before checkout.", requestId }, 400);

    let paymentId = existingPayment?.id as string | undefined;
    let orderId = existingPayment?.provider_order_id as string | undefined;

    if (paymentId && orderId) {
      if (Number(existingPayment.amount_paise) !== EARLY_ACCESS.totalPaise || existingPayment.currency !== EARLY_ACCESS.currency) {
        return json({ ok: false, code: "PAYMENT_EVIDENCE_MISMATCH", message: "The existing checkout does not match the Early Access price.", requestId }, 409);
      }
      try {
        const order = await getCashfreeOrder(orderId, requestId);
        if (!orderMatchesIntent(order, orderId, userId, paymentId)) {
          return json({ ok: false, code: "PAYMENT_EVIDENCE_MISMATCH", message: "Cashfree order details did not match this purchase.", requestId }, 409);
        }
        if (order.order_status === "PAID") {
          return json({ ok: true, orderId, paymentSessionId: null, mode: cashfreeConfig.environment, paymentPendingVerification: true, requestId });
        }
        if (order.order_status === "ACTIVE" && order.payment_session_id) {
          return json({ ok: true, orderId, paymentSessionId: order.payment_session_id, mode: cashfreeConfig.environment, reused: true, requestId });
        }
        await admin.from("billing_payments").update({ status: "failed", failed_at: new Date().toISOString() }).eq("id", paymentId);
        return json({ ok: false, code: "ORDER_NOT_PAYABLE", message: "The previous Cashfree order is no longer payable. Please try again.", requestId }, 409);
      } catch (error: unknown) {
        if (!(error instanceof CashfreeApiError) || error.status !== 404) throw error;
        // A prior network failure may have left a local intent before Cashfree
        // accepted it. Retry the same order ID and idempotency key below.
      }
    }

    if (!paymentId || !orderId) {
      const newPaymentId = crypto.randomUUID();
      const newOrderId = `ea_${newPaymentId.replaceAll("-", "")}`;
      const { data: createdIntent, error: intentError } = await admin
        .from("billing_payments")
        .insert({
          id: newPaymentId,
          workspace_id: userId,
          provider: "cashfree",
          provider_order_id: newOrderId,
          payment_type: EARLY_ACCESS.paymentType,
          base_amount_paise: EARLY_ACCESS.basePricePaise,
          gst_amount_paise: EARLY_ACCESS.gstPaise,
          gst_rate: EARLY_ACCESS.gstRate,
          amount_paise: EARLY_ACCESS.totalPaise,
          currency: EARLY_ACCESS.currency,
          status: "creating",
        })
        .select("id, provider_order_id")
        .single();
      if (intentError || !createdIntent) {
        if (intentError?.code === "23505") return json({ ok: false, code: "CHECKOUT_IN_PROGRESS", message: "A checkout is already in progress for this account.", requestId }, 409);
        console.error(`[${requestId}] cashfree_intent_failed`, intentError?.message);
        return json({ ok: false, code: "CHECKOUT_CREATE_FAILED", message: "Unable to prepare checkout. Please try again.", requestId, errorDetails: intentError }, 500);
      }
      paymentId = createdIntent.id;
      orderId = createdIntent.provider_order_id;
    }

    if (!paymentId || !orderId) {
      throw new Error("Invariant failed: paymentId or orderId is missing.");
    }

    const orderPayload = {
      order_id: orderId,
      order_amount: Number(EARLY_ACCESS.totalAmountInr),
      order_currency: EARLY_ACCESS.currency,
      customer_details: {
        customer_id: userId,
        customer_name: profile.full_name || undefined,
        customer_email: profile.email,
        customer_phone: customerPhone,
      },
      order_meta: {
        return_url: `${appBaseUrl}/billing?order_id={order_id}`,
        notify_url: `${supabaseUrl}/functions/v1/cashfree-webhook`,
      },
      order_note: "AdsHunting Early Access",
      order_tags: (function buildOrderTags() {
        const tags: Record<string, string> = {
          product: EARLY_ACCESS.paymentType,
          workspace_id: userId,
          internal_payment_id: paymentId,
          credits: String(EARLY_ACCESS.credits),
          checkout_context: "AdsHunting Early Access Payment",
        };

        try {
          const brandImage = new URL("/logo.png", appBaseUrl);
          if (brandImage.protocol === "https:" && brandImage.hostname !== "localhost") {
            tags.brand_image_url = brandImage.toString();
          }
        } catch {
          // Omit optionally if URL is invalid or local
        }
        
        return tags;
      })(),
      products: {
        one_click_checkout: {
          enabled: true,
          conditions: [{
            action: "ALLOW",
            values: ["checkoutCollectAddress", "checkoutAuthenticate"],
            key: "features",
          }],
        },
      },
      cart_details: {
        cart_items: [{
          item_id: "adshunting_early_access",
          item_name: "AdsHunting Early Access",
          item_description: "One-time Early Access with 3,000 product credits",
          item_details_url: `${appBaseUrl}/pricing`,
          item_image_url: `${appBaseUrl}/logo.png`,
          item_original_unit_price: Number(EARLY_ACCESS.totalAmountInr),
          item_discounted_unit_price: Number(EARLY_ACCESS.totalAmountInr),
          item_quantity: 1,
          item_currency: EARLY_ACCESS.currency,
        }],
      },
    };

    try {
      const order = await createCashfreeOrder(orderPayload, requestId, paymentId);
      if (!orderMatchesIntent(order, orderId, userId, paymentId) || !order.payment_session_id) {
        throw new Error("Cashfree returned an invalid order response.");
      }
      const { error: persistError } = await admin.from("billing_payments").update({ status: "active" }).eq("id", paymentId);
      if (persistError) {
        console.error(`[${requestId}] cashfree_order_persist_failed`, paymentId, orderId, persistError.message);
        return json({ ok: false, code: "ORDER_PERSIST_FAILED", message: "Checkout was created but could not be recorded safely. Please contact support.", requestId }, 500);
      }
      console.log(`[${requestId}] cashfree_occ_order_created`, paymentId, userId, orderId);
      return json({ ok: true, orderId, paymentSessionId: order.payment_session_id, mode: cashfreeConfig.environment, requestId });
    } catch (error: unknown) {
      if (error instanceof CashfreeApiError) {
        console.error(`[${requestId}] cashfree_create_failed`, paymentId, userId, orderId, error.status, error.code, error.errorType, error.message);
        if (error.status > 0 && error.status < 500) {
          await admin.from("billing_payments").update({ status: "failed", failed_at: new Date().toISOString() }).eq("id", paymentId);
        } else {
          await admin.from("billing_payments").update({ status: "pending" }).eq("id", paymentId);
        }
        return json({
          ok: false,
          code: "CASHFREE_ORDER_CREATE_FAILED",
          providerStatus: error.status,
          providerCode: error.code,
          providerType: error.errorType,
          message: error.message || "Cashfree rejected the checkout request.",
          requestId,
        }, error.status >= 400 && error.status < 600 ? error.status : 503);
      }
      console.error(`[${requestId}] cashfree_order_invalid`, paymentId, userId, orderId, error);
      return json({ ok: false, code: "INVALID_PROVIDER_RESPONSE", message: "Cashfree returned an invalid checkout response.", requestId }, 502);
    }
  } catch (error: unknown) {
    console.error(`[${requestId}] cashfree_create_error`, error instanceof Error ? error.message : String(error));
    const configError = error instanceof Error && (error.message.includes("configured") || error.message.includes("CASHFREE_ENV") || error.message.includes("APP_BASE_URL"));
    return json({ ok: false, code: configError ? "BILLING_CONFIG_MISSING" : "INTERNAL_BILLING_ERROR", message: configError ? "Cashfree checkout is not configured." : "Unable to create checkout.", requestId }, 500);
  }
});
