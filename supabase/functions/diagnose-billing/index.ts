// @ts-expect-error Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from '../_shared/cors.ts';
import { getRazorpayClient, getRazorpayPlanId } from '../_shared/razorpay.ts';

declare const Deno: { env: { get(key: string): string | undefined } };

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const diagnostics: any = {
    RAZORPAY_KEY_ID: 'missing',
    RAZORPAY_KEY_SECRET: 'missing',
    RAZORPAY_PLAN_ID: 'missing',
    RAZORPAY_WEBHOOK_SECRET: 'missing',
    RAZORPAY_AUTH_DISPLAY_AMOUNT: 'missing',
    mode_analysis: 'unknown',
    plan_fetch: 'skipped',
    plan_details: null,
    error: null
  };

  try {
    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const planIdEnv = Deno.env.get('RAZORPAY_PLAN_ID');
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
    const authDisplay = Deno.env.get('RAZORPAY_AUTH_DISPLAY_AMOUNT');

    if (keyId) diagnostics.RAZORPAY_KEY_ID = `detected (${keyId.startsWith('rzp_test_') ? 'TEST' : keyId.startsWith('rzp_live_') ? 'LIVE' : 'UNKNOWN'})`;
    if (keySecret) diagnostics.RAZORPAY_KEY_SECRET = 'detected';
    if (planIdEnv) diagnostics.RAZORPAY_PLAN_ID = `detected (length: ${planIdEnv.length})`;
    if (webhookSecret) diagnostics.RAZORPAY_WEBHOOK_SECRET = 'detected';
    if (authDisplay) diagnostics.RAZORPAY_AUTH_DISPLAY_AMOUNT = 'detected';

    if (!keyId || !keySecret || !planIdEnv) {
      diagnostics.error = "Missing essential billing configuration.";
      return new Response(JSON.stringify(diagnostics), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    const razorpay = getRazorpayClient();
    try {
      // Safe server-side provider check
      const plan = await razorpay.plans.fetch(planIdEnv);
      diagnostics.plan_fetch = 'success';
      diagnostics.plan_details = {
        id: plan.id,
        item_id: plan.item?.id,
        name: plan.item?.name,
        amount: plan.item?.amount,
        currency: plan.item?.currency,
        period: plan.period,
        interval: plan.interval
      };
      diagnostics.mode_analysis = 'Plan exists and is accessible using the provided credentials.';
    } catch (err: any) {
      diagnostics.plan_fetch = 'failed';
      diagnostics.error = {
        statusCode: err.statusCode,
        error_code: err.error?.code,
        error_description: err.error?.description,
        error_source: err.error?.source,
        error_reason: err.error?.reason,
      };
      diagnostics.mode_analysis = 'Mismatched plan/account/mode or invalid plan ID.';
    }

    return new Response(JSON.stringify(diagnostics), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (err: any) {
    diagnostics.error = String(err);
    return new Response(JSON.stringify(diagnostics), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
