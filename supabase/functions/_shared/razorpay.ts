import Razorpay from 'npm:razorpay';
import { encodeHex } from "jsr:@std/encoding/hex";

export function getRazorpayClient() {
  const key_id = Deno.env.get("RAZORPAY_KEY_ID");
  const key_secret = Deno.env.get("RAZORPAY_KEY_SECRET");

  if (!key_id || !key_secret) {
    throw new Error("Razorpay credentials are not configured on the server.");
  }

  return new Razorpay({
    key_id,
    key_secret,
  });
}

export function getRazorpayPlanId() {
  const planId = Deno.env.get("RAZORPAY_PLAN_ID");
  if (!planId) {
    throw new Error("RAZORPAY_PLAN_ID is not configured on the server.");
  }
  return planId;
}

export async function verifyRazorpayWebhookSignature(body: string, signature: string) {
  const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  if (!secret) {
    throw new Error("Razorpay webhook secret is missing.");
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify", "sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(body)
  );

  const expectedSignature = encodeHex(signatureBuffer);
  return expectedSignature === signature;
}
