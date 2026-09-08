import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCashfreeOrder, getCashfreePaymentsForOrder, validateCashfreeEarlyAccessEvidence, CashfreeApiError } from "../_shared/cashfree.ts";
import { inrAmountToPaise, EARLY_ACCESS } from "../_shared/early-access.ts";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const orderId = url.searchParams.get("order_id");
    const workspaceId = url.searchParams.get("workspace_id");
    const paymentId = url.searchParams.get("payment_id");

    if (!orderId) {
      return new Response("Missing order_id", { status: 400 });
    }

    const order = await getCashfreeOrder(orderId, "test-req");
    const payments = await getCashfreePaymentsForOrder(orderId, "test-req");

    let evidence;
    try {
      evidence = validateCashfreeEarlyAccessEvidence(order, payments, {
        orderId,
        workspaceId: workspaceId || order.customer_details?.customer_id || "",
        internalPaymentId: paymentId || order.order_tags?.internal_payment_id || "",
        amountPaise: EARLY_ACCESS.totalPaise,
        currency: EARLY_ACCESS.currency,
        paymentType: EARLY_ACCESS.paymentType,
      }, inrAmountToPaise);
    } catch (e) {
      evidence = { error: String(e) };
    }

    return new Response(JSON.stringify({
      order,
      payments,
      evidence
    }, null, 2), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    if (error instanceof CashfreeApiError) {
      return new Response(JSON.stringify({
        isApiError: true,
        status: error.status,
        code: error.code,
        type: error.errorType,
        message: error.message
      }), { headers: { "Content-Type": "application/json" }, status: 500 });
    }
    return new Response(String(error), { status: 500 });
  }
});
