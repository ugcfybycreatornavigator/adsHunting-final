-- Temporary one-time Early Access checkout layered onto the existing billing tables.
-- Historical Razorpay fields remain intact for financial auditability.

alter table public.billing_payments
  alter column razorpay_payment_id drop not null,
  add column if not exists provider text not null default 'razorpay',
  add column if not exists provider_order_id text,
  add column if not exists provider_payment_id text,
  add column if not exists payment_type text not null default 'subscription',
  add column if not exists base_amount_paise bigint,
  add column if not exists gst_amount_paise bigint,
  add column if not exists gst_rate numeric(5,4),
  add column if not exists credits_granted bigint not null default 0;

update public.billing_payments
set provider_payment_id = razorpay_payment_id
where provider_payment_id is null and razorpay_payment_id is not null;

create unique index if not exists uq_billing_payments_provider_order
  on public.billing_payments (provider, provider_order_id)
  where provider_order_id is not null;

create unique index if not exists uq_billing_payments_provider_payment
  on public.billing_payments (provider, provider_payment_id)
  where provider_payment_id is not null;

create unique index if not exists uq_early_access_payment_per_workspace
  on public.billing_payments (workspace_id)
  where payment_type = 'early_access'
    and status in ('creating', 'active', 'attempted', 'pending', 'paid');

alter table public.workspace_credit_balances
  add column if not exists source_payment_id uuid references public.billing_payments(id);

create unique index if not exists uq_workspace_credit_source_payment
  on public.workspace_credit_balances (source_payment_id)
  where source_payment_id is not null;

create or replace function public.finalize_early_access_purchase(
  p_workspace_id text,
  p_provider text,
  p_order_id text,
  p_payment_id text,
  p_paid_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.billing_payments%rowtype;
  v_balance public.workspace_credit_balances%rowtype;
begin
  select * into v_payment
  from public.billing_payments
  where workspace_id = p_workspace_id
    and provider = p_provider
    and provider_order_id = p_order_id
    and payment_type = 'early_access'
  for update;

  if not found then
    raise exception 'EARLY_ACCESS_PAYMENT_NOT_FOUND';
  end if;

  if v_payment.base_amount_paise is distinct from 49900
     or v_payment.gst_amount_paise is distinct from 8982
     or v_payment.amount_paise is distinct from 58882
     or v_payment.currency is distinct from 'INR' then
    raise exception 'EARLY_ACCESS_AMOUNT_MISMATCH';
  end if;

  if v_payment.provider_payment_id is not null
     and v_payment.provider_payment_id <> p_payment_id then
    raise exception 'EARLY_ACCESS_PAYMENT_ID_MISMATCH';
  end if;

  update public.billing_payments
  set provider_payment_id = p_payment_id,
      status = 'paid',
      paid_at = coalesce(paid_at, p_paid_at),
      failed_at = null,
      credits_granted = 3000,
      updated_at = now()
  where id = v_payment.id;

  insert into public.billing_access_grants (workspace_id, grant_type, starts_at, ends_at, reason)
  values (p_workspace_id, 'early_access', p_paid_at, null, 'verified_cashfree_early_access_purchase')
  on conflict (workspace_id, grant_type) do nothing;

  insert into public.workspace_credit_balances (
    workspace_id, subscription_id, cycle_start, cycle_end,
    credits_allocated, credits_used, source_payment_id
  ) values (
    p_workspace_id, null, p_paid_at, 'infinity'::timestamptz,
    3000, 0, v_payment.id
  )
  on conflict (source_payment_id) where source_payment_id is not null do nothing;

  select * into v_balance
  from public.workspace_credit_balances
  where source_payment_id = v_payment.id;

  return jsonb_build_object(
    'active', true,
    'alreadyProcessed', v_payment.status = 'paid',
    'creditsGranted', 3000,
    'creditsRemaining', greatest(0, v_balance.credits_allocated - v_balance.credits_used)
  );
end;
$$;

revoke all on function public.finalize_early_access_purchase(text, text, text, text, timestamptz) from public;
revoke all on function public.finalize_early_access_purchase(text, text, text, text, timestamptz) from anon;
revoke all on function public.finalize_early_access_purchase(text, text, text, text, timestamptz) from authenticated;
grant execute on function public.finalize_early_access_purchase(text, text, text, text, timestamptz) to service_role;

-- Prefer the newest credit allocation if a future subscription begins later.
create or replace function public.report_credit_usage_batch(
  p_workspace_id text,
  p_user_id text,
  p_search_session_id text,
  p_event_type text,
  p_ad_ids text[],
  p_cost_per_event integer,
  p_metadata jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance_record record;
  v_ad_id text;
  v_actually_charged integer := 0;
  v_remaining_before integer;
  v_accepted_ad_ids text[] := '{}';
  v_rejected_ad_ids text[] := '{}';
begin
  select * into v_balance_record
  from public.workspace_credit_balances
  where workspace_id = p_workspace_id and cycle_end > now()
  order by cycle_start desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'NO_ACTIVE_CYCLE', 'message', 'No active billing cycle found for workspace.', 'creditsRemaining', 0);
  end if;

  v_remaining_before := v_balance_record.credits_allocated - v_balance_record.credits_used;
  if v_remaining_before <= 0 then
    return jsonb_build_object('success', false, 'error', 'INSUFFICIENT_CREDITS', 'message', 'No credits remaining in the current cycle.', 'creditsRemaining', 0, 'acceptedAdIds', v_accepted_ad_ids, 'rejectedAdIds', p_ad_ids, 'exhausted', true);
  end if;

  foreach v_ad_id in array p_ad_ids loop
    if (v_balance_record.credits_allocated - (v_balance_record.credits_used + v_actually_charged)) < p_cost_per_event then
      v_rejected_ad_ids := array_append(v_rejected_ad_ids, v_ad_id);
      continue;
    end if;
    begin
      insert into public.credit_usage_events (workspace_id, user_id, search_session_id, ad_id, event_type, credits, billing_cycle_id, metadata)
      values (p_workspace_id, p_user_id, p_search_session_id, v_ad_id, p_event_type, p_cost_per_event, v_balance_record.id, p_metadata);
      v_actually_charged := v_actually_charged + p_cost_per_event;
      v_accepted_ad_ids := array_append(v_accepted_ad_ids, v_ad_id);
    exception when unique_violation then
      null;
    end;
  end loop;

  if v_actually_charged > 0 then
    update public.workspace_credit_balances
    set credits_used = credits_used + v_actually_charged, updated_at = now()
    where id = v_balance_record.id;
  end if;

  return jsonb_build_object(
    'success', true,
    'creditsCharged', v_actually_charged,
    'creditsRemaining', v_balance_record.credits_allocated - (v_balance_record.credits_used + v_actually_charged),
    'acceptedAdIds', v_accepted_ad_ids,
    'rejectedAdIds', v_rejected_ad_ids,
    'exhausted', (v_balance_record.credits_allocated - (v_balance_record.credits_used + v_actually_charged) <= 0)
  );
end;
$$;
