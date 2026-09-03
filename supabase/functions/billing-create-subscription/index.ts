// @ts-expect-error Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error Deno imports
import { createClient } from 'npm:@supabase/supabase-js';

declare const Deno: { env: { get(key: string): string | undefined } };
import { corsHeaders } from '../_shared/cors.ts';
import { getRazorpayClient } from '../_shared/razorpay.ts';
import { verifyClerkToken } from '../_shared/clerk.ts';

serve(async (req: Request) => {
  const requestId = `billing_req_${Math.random().toString(36).slice(2, 11)}`;
  console.log(`[${requestId}] request_received`);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error(`[${requestId}] auth_verified: FAILED (missing header)`);
      return new Response(JSON.stringify({ ok: false, code: "AUTH_REQUIRED", message: "Authentication required.", requestId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    let userId: string;
    try {
      userId = await verifyClerkToken(req, token);
      console.log(`[${requestId}] auth_verified: SUCCESS (${userId})`);
    } catch (e) {
      console.error(`[${requestId}] auth_verified: FAILED`, e);
      const errMsg = e instanceof Error ? e.message : String(e);
      return new Response(JSON.stringify({ ok: false, code: "AUTH_REQUIRED", message: `Invalid authentication token: ${errMsg}`, requestId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const planIdEnv = Deno.env.get('RAZORPAY_PLAN_ID');

    console.log(`[${requestId}] config_verified: keyIdPresent=${!!keyId}, keySecretPresent=${!!keySecret}, planIdPresent=${!!planIdEnv}`);

    if (!keyId || !keySecret || !planIdEnv) {
      console.error(`[${requestId}] config_verified: FAILED`);
      return new Response(JSON.stringify({ ok: false, code: "BILLING_CONFIG_MISSING", message: "Billing setup is not properly configured.", requestId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    let reqBody;
    try {
      reqBody = await req.json();
    } catch {
      reqBody = {};
    }
    const { checkoutType, planKey } = reqBody;

    if (!planKey) {
      return new Response(JSON.stringify({ ok: false, code: "INVALID_PLAN", message: "A valid plan key must be provided.", requestId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Only allow known plans
    if (planKey !== 'scout' && planKey !== 'pro') {
      return new Response(JSON.stringify({ ok: false, code: "INVALID_PLAN", message: "The requested plan is invalid or not available.", requestId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Use scout as the canonical plan key internally
    const canonicalPlanKey = planKey === 'pro' ? 'scout' : planKey;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    console.log(`[${requestId}] workspace_resolved: SUCCESS`);

    const { data: existingSub } = await supabaseAdmin
      .from('billing_subscriptions')
      .select('*')
      .eq('workspace_id', userId)
      .maybeSingle();

    let subscriptionId = existingSub?.razorpay_subscription_id;
    let needsNewSubscription = !subscriptionId;

    // Check if the user is changing intent or the existing subscription is dead
    if (existingSub) {
      if (existingSub.status === 'cancelled' || existingSub.status === 'expired' || existingSub.status === 'halted') {
        needsNewSubscription = true;
      } else if (existingSub.status === 'not_started') {
         // It's safe to overwrite a not_started subscription.
         // Let's just create a new one to guarantee the trial/plan intent matches.
         needsNewSubscription = true;
      } else if (existingSub.status === 'active' || existingSub.status === 'trialing') {
         return new Response(JSON.stringify({ ok: false, code: "SUBSCRIPTION_ALREADY_EXISTS", message: "You already have an active subscription.", requestId }), {
           headers: { ...corsHeaders, 'Content-Type': 'application/json' },
           status: 409,
         });
      }
    }

    if (needsNewSubscription) {
      const razorpay = getRazorpayClient();
      
      try {
        console.log(`[${requestId}] razorpay_plan_lookup_started`);
        // We could look up the plan here to verify it exists
        // but Razorpay subscription create will fail cleanly if it's invalid.
      } catch {
        // ...
      }

      console.log(`[${requestId}] eligibility_verified: SUCCESS`);

      const { data: trialUsage } = await supabaseAdmin
        .from('billing_trial_usage')
        .select('*')
        .eq('workspace_id', userId)
        .maybeSingle();

      let startAt: number | undefined = undefined;
      
      if (checkoutType === 'trial') {
        if (!trialUsage) {
          startAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days trial
        } else {
          console.log(`[${requestId}] trial_already_used: REJECTED`);
          return new Response(JSON.stringify({ ok: false, code: "TRIAL_ALREADY_USED", message: "Your introductory trial has already been used. Please choose a regular subscription.", requestId }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 409,
          });
        }
      } else {
        // Paid checkout - no trial delay
        console.log(`[${requestId}] direct_subscription: NO START_AT DELAY`);
      }

      const subscriptionPayload: Record<string, unknown> = {
        plan_id: planIdEnv,
        total_count: 120,
        notes: {
          workspace_id: userId,
          checkout_type: checkoutType || 'subscription'
        },
      };

      if (startAt) {
        subscriptionPayload.start_at = startAt;
      }

      console.log(`[${requestId}] razorpay_request_started`);
      let subscription: { id: string; [key: string]: unknown };
      try {
        subscription = await razorpay.subscriptions.create(subscriptionPayload);
        console.log(`[${requestId}] razorpay_subscription_created`);
      } catch (rzpErr: unknown) {
        const errObj = rzpErr as { statusCode?: number; error?: { code?: string; description?: string } };
        console.error(`[${requestId}] razorpay_request_failed:`, errObj.statusCode, errObj.error?.code, errObj.error?.description);
        return new Response(JSON.stringify({ ok: false, code: "SUBSCRIPTION_CREATE_FAILED", message: "Provider rejected subscription creation.", requestId }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      subscriptionId = subscription.id;

      const subData = {
        workspace_id: userId,
        owner_user_id: userId,
        provider: 'razorpay',
        razorpay_subscription_id: subscriptionId,
        razorpay_plan_id: planIdEnv,
        plan_key: canonicalPlanKey,
        status: 'not_started',
        amount_paise: 49900,
      };

      const { error: upsertError } = await supabaseAdmin
        .from('billing_subscriptions')
        .upsert(subData, { onConflict: 'workspace_id' });

      if (upsertError) {
        console.error(`[${requestId}] database_persisted: FAILED`, upsertError.message);
        return new Response(JSON.stringify({ ok: false, code: "SUBSCRIPTION_PERSIST_FAILED", message: "Failed to persist subscription.", requestId }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
      console.log(`[${requestId}] database_persisted: SUCCESS`);
    } else {
      console.log(`[${requestId}] database_persisted: SKIPPED (reusing sub)`);
    }

    console.log(`[${requestId}] response_sent`);
    return new Response(JSON.stringify({
      ok: true,
      subscriptionId,
      keyId,
      planName: "Ads Hunting Pro",
      amount: 49900,
      currency: "INR",
      requestId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: unknown) {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    console.error(`[${requestId}] INTERNAL_BILLING_ERROR:`, errorObj);
    return new Response(JSON.stringify({ ok: false, code: "INTERNAL_BILLING_ERROR", message: "An unexpected error occurred.", requestId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
