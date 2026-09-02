// @ts-expect-error Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error Deno imports
import { createClient } from 'npm:@supabase/supabase-js';

declare const Deno: { env: { get(key: string): string | undefined } };
import { corsHeaders } from '../_shared/cors.ts';
import { getRazorpayClient } from '../_shared/razorpay.ts';
import { verifyClerkToken } from '../_shared/clerk.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const token = authHeader.replace('Bearer ', '');
    
    let userId: string;
    try {
      userId = await verifyClerkToken(req, token);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      return new Response(JSON.stringify({ error: `Invalid authentication token: ${errMsg}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { data: localSub } = await supabaseAdmin
      .from('billing_subscriptions')
      .select('*')
      .eq('workspace_id', userId)
      .maybeSingle();

    if (!localSub || !localSub.razorpay_subscription_id) {
       return new Response(JSON.stringify({ status: "not_started" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    const rzp = getRazorpayClient();
    const rzpSub = await rzp.subscriptions.fetch(localSub.razorpay_subscription_id);

    const updates: Record<string, unknown> = {
       provider_status: rzpSub.status,
    };
    
    const now = new Date();

    if (rzpSub.status === "active") {
       updates.status = "active";
       updates.current_period_start = rzpSub.current_start ? new Date(rzpSub.current_start * 1000).toISOString() : now.toISOString();
       updates.current_period_end = rzpSub.current_end ? new Date(rzpSub.current_end * 1000).toISOString() : now.toISOString();
       updates.next_charge_at = rzpSub.charge_at ? new Date(rzpSub.charge_at * 1000).toISOString() : null;
    } else if (rzpSub.status === "authenticated") {
       updates.status = "trialing";
       if (!localSub.trial_started_at) {
         updates.trial_started_at = now.toISOString();
       }
       updates.trial_ends_at = rzpSub.start_at ? new Date(rzpSub.start_at * 1000).toISOString() : null;
    } else if (rzpSub.status === "created") {
       if (localSub.status !== "active" && localSub.status !== "trialing") {
         updates.status = "not_started";
       } else {
         // Do not downgrade active/trialing to not_started due to provider latency
         updates.status = localSub.status;
       }
    } else if (rzpSub.status === "cancelled" || rzpSub.status === "completed") {
       updates.status = rzpSub.status === "cancelled" ? "cancelled" : "completed";
       updates.cancelled_at = now.toISOString();
    } else {
       updates.status = "locked";
    }

    await supabaseAdmin
      .from('billing_subscriptions')
      .update(updates)
      .eq('id', localSub.id);

    return new Response(JSON.stringify({ status: updates.status }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: unknown) {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    return new Response(JSON.stringify({ error: errorObj.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
