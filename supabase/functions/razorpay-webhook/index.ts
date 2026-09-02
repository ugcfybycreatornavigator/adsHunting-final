// @ts-expect-error Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error Deno imports
import { createClient } from 'npm:@supabase/supabase-js';

declare const Deno: { env: { get(key: string): string | undefined } };
import { verifyRazorpayWebhookSignature } from '../_shared/razorpay.ts';

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    if (!signature) {
      return new Response('Missing signature', { status: 400 });
    }

    const isValid = await verifyRazorpayWebhookSignature(rawBody, signature);
    if (!isValid) {
      return new Response('Invalid signature', { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const eventId = req.headers.get('x-razorpay-event-id') || event.event_id;

    if (!eventId) {
       return new Response('Missing event ID', { status: 400 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Idempotency check
    const { data: existingEvent } = await supabaseAdmin
      .from('billing_webhook_events')
      .select('id, processing_status')
      .eq('provider_event_id', eventId)
      .maybeSingle();

    if (existingEvent && existingEvent.processing_status === 'processed') {
      return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (!existingEvent) {
      await supabaseAdmin.from('billing_webhook_events').insert({
        provider_event_id: eventId,
        event_type: event.event,
        payload_json: event,
        processing_status: 'pending'
      });
    }

    // Process event
    const payload = event.payload;
    const subscription = payload.subscription?.entity;
    const payment = payload.payment?.entity;

    if (subscription) {
      const { data: localSub } = await supabaseAdmin
        .from('billing_subscriptions')
        .select('*')
        .eq('razorpay_subscription_id', subscription.id)
        .maybeSingle();

      if (localSub) {
        const updates: Record<string, unknown> = { provider_status: subscription.status };
        const now = new Date();

        if (subscription.status === "active") {
           updates.status = "active";
           updates.current_period_start = subscription.current_start ? new Date(subscription.current_start * 1000).toISOString() : now.toISOString();
           updates.current_period_end = subscription.current_end ? new Date(subscription.current_end * 1000).toISOString() : now.toISOString();
           updates.next_charge_at = subscription.charge_at ? new Date(subscription.charge_at * 1000).toISOString() : null;
        } else if (subscription.status === "authenticated") {
           updates.status = "trialing";
           if (!localSub.trial_started_at) updates.trial_started_at = now.toISOString();
           updates.trial_ends_at = subscription.start_at ? new Date(subscription.start_at * 1000).toISOString() : null;
           
           // Durably record trial usage
           await supabaseAdmin.from('billing_trial_usage').upsert({
             workspace_id: localSub.workspace_id,
             trial_activated_at: now.toISOString(),
             razorpay_subscription_id: subscription.id
           }, { onConflict: 'workspace_id' });
        } else if (subscription.status === "cancelled" || subscription.status === "completed") {
           updates.status = subscription.status;
           updates.cancelled_at = now.toISOString();
        } else if (subscription.status === "halted" || subscription.status === "pending") {
           updates.status = "locked";
        }

        await supabaseAdmin.from('billing_subscriptions').update(updates).eq('id', localSub.id);
      }
    }

    if (payment && subscription) {
      const { data: localSub } = await supabaseAdmin
        .from('billing_subscriptions')
        .select('id, workspace_id')
        .eq('razorpay_subscription_id', subscription.id)
        .maybeSingle();

      if (localSub) {
        // Upsert payment using provider_payment_id
        const { error: paymentError } = await supabaseAdmin.from('billing_payments').upsert({
          workspace_id: localSub.workspace_id,
          subscription_id: localSub.id,
          razorpay_payment_id: payment.id,
          razorpay_invoice_id: payment.invoice_id,
          amount_paise: payment.amount,
          currency: payment.currency,
          status: payment.status,
          paid_at: payment.status === 'captured' ? new Date().toISOString() : null,
          failed_at: payment.status === 'failed' ? new Date().toISOString() : null,
        }, { onConflict: 'razorpay_payment_id' });
        
        if (paymentError) console.error("Payment insert error:", paymentError);
      }
    }

    await supabaseAdmin
      .from('billing_webhook_events')
      .update({ processing_status: 'processed', processed_at: new Date().toISOString() })
      .eq('provider_event_id', eventId);

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err: unknown) {
    console.error("Webhook error:", err);
    return new Response('Webhook handling failed', { status: 400 });
  }
});
