import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createCashfreeOrder, CashfreeApiError } from "../_shared/cashfree.ts";
import { EARLY_ACCESS } from "../_shared/early-access.ts";

serve(async () => {
  const payload = {
    order_id: "test_" + Date.now(),
    order_amount: Number(EARLY_ACCESS.totalAmountInr),
    order_currency: EARLY_ACCESS.currency,
    customer_details: {
      customer_id: "user_123",
      customer_email: "test@example.com",
      customer_phone: "9685070128",
    },
    order_meta: {
      return_url: "https://adshunting.com/billing?order_id={order_id}",
      notify_url: "https://adshunting.com/api/webhook",
    },
    order_note: "AdsHunting Early Access",
    order_tags: {
      product: EARLY_ACCESS.paymentType,
      workspace_id: "user_123",
      internal_payment_id: "pay_123",
      credits: String(EARLY_ACCESS.credits),
      checkout_context: "AdsHunting Early Access — ₹499 + 18% GST",
    },
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
        item_details_url: "https://adshunting.com/pricing",
        item_image_url: "https://adshunting.com/logo.png",
        item_original_unit_price: Number(EARLY_ACCESS.totalAmountInr),
        item_discounted_unit_price: Number(EARLY_ACCESS.totalAmountInr),
        item_quantity: 1,
        item_currency: EARLY_ACCESS.currency,
      }],
    },
  };

  try {
    const order = await createCashfreeOrder(payload, "test-req", "test-idem");
    return new Response(JSON.stringify(order), { headers: { "Content-Type": "application/json" } });
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
