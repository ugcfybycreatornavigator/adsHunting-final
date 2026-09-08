import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const { EARLY_ACCESS, formatPaise, inrAmountToPaise } = createRequire(import.meta.url)(
  "../supabase/functions/_shared/early-access.ts",
) as typeof import("../supabase/functions/_shared/early-access");
const { validateCashfreeEarlyAccessEvidence } = createRequire(import.meta.url)(
  "../supabase/functions/_shared/cashfree.ts",
) as typeof import("../supabase/functions/_shared/cashfree");

const migration = readFileSync("supabase/migrations/20260908000100_early_access_checkout.sql", "utf8");
const createFunction = readFileSync("supabase/functions/billing-create-early-access/index.ts", "utf8");
const verifyFunction = readFileSync("supabase/functions/billing-verify-early-access/index.ts", "utf8");
const webhook = readFileSync("supabase/functions/cashfree-webhook/index.ts", "utf8");
const cashfree = readFileSync("supabase/functions/_shared/cashfree.ts", "utf8");
const checkout = readFileSync("components/billing/EarlyAccessCheckout.tsx", "utf8");
const config = readFileSync("supabase/config.toml", "utf8");
const billingConfig = readFileSync("lib/billing/billing-config.ts", "utf8");
const packageManifest = readFileSync("package.json", "utf8");

test("Early Access price and credit constants are exact and decimal-safe", () => {
  assert.equal(EARLY_ACCESS.basePricePaise, 49_900);
  assert.equal(EARLY_ACCESS.gstPaise, 8_982);
  assert.equal(EARLY_ACCESS.totalPaise, 58_882);
  assert.equal(EARLY_ACCESS.credits, 3_000);
  assert.equal(EARLY_ACCESS.totalAmountInr, "588.82");
  assert.equal(inrAmountToPaise("588.82"), 58_882);
  assert.equal(inrAmountToPaise(588.82), 58_882);
  assert.equal(formatPaise(EARLY_ACCESS.totalPaise), "₹588.82");
});

test("Cashfree order creation uses server constants and mandatory One Click Checkout", () => {
  assert.match(cashfree, /CASHFREE_API_VERSION = "2026-01-01"/);
  assert.match(createFunction, /order_amount:\s*Number\(EARLY_ACCESS\.totalAmountInr\)/);
  assert.doesNotMatch(createFunction, /body\?\.(amount|credits)|body\.(amount|credits)/);
  assert.match(createFunction, /one_click_checkout:\s*\{/);
  assert.match(createFunction, /enabled:\s*true/);
  assert.match(createFunction, /checkoutCollectAddress/);
  assert.match(createFunction, /checkoutAuthenticate/);
  assert.match(createFunction, /payment_session_id/);
  assert.match(createFunction, /x-idempotency-key|createCashfreeOrder\(orderPayload, requestId, paymentId\)/);
});

test("server verification requires authenticated ownership and authoritative Cashfree evidence", () => {
  assert.match(verifyFunction, /verifyClerkToken/);
  assert.match(verifyFunction, /\.eq\("workspace_id", workspaceId\)/);
  assert.match(verifyFunction, /getCashfreeOrder/);
  assert.match(verifyFunction, /getCashfreePaymentsForOrder/);
  assert.match(cashfree, /order\.order_status === "PAID"/);
  assert.match(cashfree, /payment\.payment_status === "SUCCESS"/);
  assert.match(cashfree, /order\.customer_details\?\.customer_id !== expected\.workspaceId/);
  assert.match(cashfree, /amountToPaise\(payment\.payment_amount\) === expected\.amountPaise/);
  assert.match(cashfree, /order\.order_tags\?\.internal_payment_id !== expected\.internalPaymentId/);
});

test("Cashfree evidence maps paid, pending, failed, cancelled, and dropped states without granting early", () => {
  const expected = {
    orderId: "ea_1234567890abcdef1234567890abcdef",
    workspaceId: "user_123",
    internalPaymentId: "11111111-1111-4111-8111-111111111111",
    amountPaise: 58_882,
    currency: "INR",
    paymentType: "early_access",
  };
  const order = {
    cf_order_id: "cashfree-order",
    order_id: expected.orderId,
    order_amount: 588.82,
    order_currency: "INR",
    order_status: "PAID",
    customer_details: { customer_id: expected.workspaceId },
    order_tags: {
      product: expected.paymentType,
      workspace_id: expected.workspaceId,
      internal_payment_id: expected.internalPaymentId,
    },
  };
  const payment = {
    cf_payment_id: 987654,
    order_id: expected.orderId,
    order_amount: 588.82,
    order_currency: "INR",
    payment_amount: 588.82,
    payment_currency: "INR",
    payment_status: "SUCCESS" as const,
    payment_completion_time: "2026-09-08T10:00:00Z",
  };

  assert.deepEqual(validateCashfreeEarlyAccessEvidence(order, [payment], expected, inrAmountToPaise), {
    state: "paid",
    paymentId: "987654",
    paidAt: "2026-09-08T10:00:00Z",
  });
  assert.equal(validateCashfreeEarlyAccessEvidence({ ...order, order_status: "ACTIVE" }, [{ ...payment, payment_status: "PENDING" }], expected, inrAmountToPaise).state, "pending");
  assert.equal(validateCashfreeEarlyAccessEvidence({ ...order, order_status: "EXPIRED" }, [{ ...payment, payment_status: "FAILED" }], expected, inrAmountToPaise).state, "failed");
  assert.equal(validateCashfreeEarlyAccessEvidence({ ...order, order_status: "EXPIRED" }, [{ ...payment, payment_status: "CANCELLED" }], expected, inrAmountToPaise).state, "cancelled");
  assert.equal(validateCashfreeEarlyAccessEvidence({ ...order, order_status: "EXPIRED" }, [{ ...payment, payment_status: "USER_DROPPED" }], expected, inrAmountToPaise).state, "user_dropped");
  assert.throws(() => validateCashfreeEarlyAccessEvidence({ ...order, order_amount: 500 }, [payment], expected, inrAmountToPaise), /EVIDENCE_MISMATCH/);
});

test("database finalization makes access and credits atomic and idempotent", () => {
  assert.match(migration, /for update/i);
  assert.match(migration, /provider = p_provider/i);
  assert.match(migration, /on conflict \(workspace_id, grant_type\) do nothing/i);
  assert.match(migration, /on conflict \(source_payment_id\).*do nothing/i);
  assert.match(migration, /credits_allocated[\s\S]*3000/);
  assert.match(migration, /grant execute[\s\S]*service_role/i);
  assert.match(migration, /revoke all[\s\S]*authenticated/i);
});

test("signed webhook re-fetches provider state before using the same finalization path", () => {
  assert.match(webhook, /verifyCashfreeWebhookSignature\(rawBody, timestamp, signature\)/);
  assert.ok(webhook.indexOf("verifyCashfreeWebhookSignature") < webhook.indexOf("JSON.parse(rawBody)"));
  assert.match(webhook, /PAYMENT_SUCCESS_WEBHOOK/);
  assert.match(webhook, /PAYMENT_FAILED_WEBHOOK/);
  assert.match(webhook, /PAYMENT_USER_DROPPED_WEBHOOK/);
  assert.match(webhook, /getCashfreeOrder/);
  assert.match(webhook, /getCashfreePaymentsForOrder/);
  assert.match(webhook, /finalize_early_access_purchase/);
});

test("browser checkout uses Cashfree v3 and never treats browser data as fulfillment evidence", () => {
  assert.match(checkout, /https:\/\/sdk\.cashfree\.com\/js\/v3\/cashfree\.js/);
  assert.match(checkout, /redirectTarget:\s*"_modal"/);
  assert.match(checkout, /body:\s*\{ orderId \}/);
  assert.doesNotMatch(checkout, /razorpay/i);
});

test("active runtime billing surface has no Razorpay integration", () => {
  for (const [name, source] of [
    ["checkout", checkout],
    ["create function", createFunction],
    ["verify function", verifyFunction],
    ["webhook", webhook],
    ["edge config", config],
    ["billing config", billingConfig],
    ["Cashfree helper", cashfree],
    ["package manifest", packageManifest],
  ]) {
    assert.doesNotMatch(source, /razorpay/i, `${name} still references Razorpay`);
  }
});
