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

    const { data: sub } = await supabaseAdmin
      .from('billing_subscriptions')
      .select('*')
      .eq('workspace_id', userId)
      .maybeSingle();

    if (!sub || !sub.razorpay_subscription_id) {
      throw new Error("No active subscription found.");
    }

    const rzp = getRazorpayClient();
    await rzp.subscriptions.cancel(sub.razorpay_subscription_id, false); // Cancel at period end

    await supabaseAdmin
      .from('billing_subscriptions')
      .update({ cancel_at_period_end: true })
      .eq('id', sub.id);

    return new Response(JSON.stringify({ success: true, message: "Subscription will cancel at period end." }), {
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
