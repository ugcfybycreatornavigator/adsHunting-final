-- Migration: Billing Enforcement & Legacy Grace
-- Adds explicit access grants and durable trial usage tracking

create table if not exists public.billing_access_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.profiles(id) on delete cascade,
  grant_type text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  reason text,
  created_at timestamptz not null default now(),
  
  constraint unique_grant_type_per_workspace unique (workspace_id, grant_type)
);

create table if not exists public.billing_trial_usage (
  workspace_id text primary key references public.profiles(id) on delete cascade,
  trial_activated_at timestamptz not null default now(),
  razorpay_subscription_id text not null,
  created_at timestamptz not null default now()
);

alter table public.billing_access_grants enable row level security;
alter table public.billing_trial_usage enable row level security;

-- Admin only RLS (Server side accessed only using service_role)
create policy "billing_access_grants select admin" on public.billing_access_grants for select to authenticated using (workspace_id = (select auth.jwt()->>'sub'));
create policy "billing_trial_usage select admin" on public.billing_trial_usage for select to authenticated using (workspace_id = (select auth.jwt()->>'sub'));

-- Snapshot existing legacy users created before the cutoff
-- The cutoff is 2026-08-19T16:38:00+05:30 (11:08:00Z)
-- Grace period ends 2026-09-01T00:00:00+05:30 (2026-08-31T18:30:00Z)
insert into public.billing_access_grants (workspace_id, grant_type, starts_at, ends_at, reason)
select 
  id, 
  'legacy_grace', 
  now(), 
  '2026-08-31T18:30:00Z',
  'pre_billing_existing_customer'
from public.profiles
where created_at < '2026-08-19T11:08:00Z'
on conflict (workspace_id, grant_type) do nothing;
