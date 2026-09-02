-- Migration: Credit Usage Tracking
-- Implements robust, idempotent, and atomic credit tracking

create table if not exists public.workspace_credit_balances (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  subscription_id text,
  cycle_start timestamptz not null,
  cycle_end timestamptz not null,
  credits_allocated bigint not null default 10000,
  credits_used bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_workspace_billing_cycle unique (workspace_id, cycle_start, cycle_end)
);

create table if not exists public.credit_usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  user_id text not null,
  search_session_id text not null,
  ad_id text not null,
  event_type text not null,
  credits integer not null,
  billing_cycle_id uuid references public.workspace_credit_balances(id),
  metadata jsonb,
  created_at timestamptz not null default now(),

  constraint uq_credit_usage_event unique (workspace_id, search_session_id, ad_id, event_type)
);

-- Indexes for performance
create index if not exists idx_wcb_active_cycle on public.workspace_credit_balances(workspace_id, cycle_end desc);
create index if not exists idx_cue_workspace_session on public.credit_usage_events(workspace_id, search_session_id);

-- RLS policies
alter table public.workspace_credit_balances enable row level security;
alter table public.credit_usage_events enable row level security;

-- Admin policies (backend logic uses service_role, frontend can read its own)
create policy "balances select admin" on public.workspace_credit_balances for select to authenticated using (workspace_id = (select auth.jwt()->>'sub'));
create policy "usage select admin" on public.credit_usage_events for select to authenticated using (workspace_id = (select auth.jwt()->>'sub'));

-- Trigger for updated_at
create trigger workspace_credit_balances_touch_updated_at before update on public.workspace_credit_balances for each row execute function public.touch_updated_at();

-- Atomic RPC for batch usage reporting
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
as $$
declare
  v_balance_record record;
  v_ad_id text;
  v_actually_charged integer := 0;
  v_remaining_before integer;
  v_accepted_ad_ids text[] := '{}';
  v_rejected_ad_ids text[] := '{}';
begin
  -- 1. Find the current active billing cycle for the workspace and lock it
  select * into v_balance_record
  from public.workspace_credit_balances
  where workspace_id = p_workspace_id
    and cycle_end > now()
  order by cycle_end desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'NO_ACTIVE_CYCLE',
      'message', 'No active billing cycle found for workspace.',
      'creditsRemaining', 0
    );
  end if;

  v_remaining_before := v_balance_record.credits_allocated - v_balance_record.credits_used;

  if v_remaining_before <= 0 then
    return jsonb_build_object(
      'success', false,
      'error', 'INSUFFICIENT_CREDITS',
      'message', 'No credits remaining in the current cycle.',
      'creditsRemaining', 0,
      'acceptedAdIds', v_accepted_ad_ids,
      'rejectedAdIds', p_ad_ids,
      'exhausted', true
    );
  end if;

  -- 2. Process each ad ID
  foreach v_ad_id in array p_ad_ids loop
    -- Check if we have enough credits for one more
    if (v_balance_record.credits_allocated - (v_balance_record.credits_used + v_actually_charged)) < p_cost_per_event then
      v_rejected_ad_ids := array_append(v_rejected_ad_ids, v_ad_id);
      continue;
    end if;

    -- Attempt to insert the event
    begin
      insert into public.credit_usage_events (
        workspace_id,
        user_id,
        search_session_id,
        ad_id,
        event_type,
        credits,
        billing_cycle_id,
        metadata
      ) values (
        p_workspace_id,
        p_user_id,
        p_search_session_id,
        v_ad_id,
        p_event_type,
        p_cost_per_event,
        v_balance_record.id,
        p_metadata
      );
      
      -- If successful, increment tracking
      v_actually_charged := v_actually_charged + p_cost_per_event;
      v_accepted_ad_ids := array_append(v_accepted_ad_ids, v_ad_id);
    exception when unique_violation then
      -- Already charged, do not deduct again
    end;
  end loop;

  -- 3. Update the balance
  if v_actually_charged > 0 then
    update public.workspace_credit_balances
    set credits_used = credits_used + v_actually_charged,
        updated_at = now()
    where id = v_balance_record.id;
  end if;

  -- 4. Return results
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
