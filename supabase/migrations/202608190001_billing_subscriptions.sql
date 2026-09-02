-- Migration: Billing Subscriptions and Webhook Events
-- Creates tables for Razorpay billing integration

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null, -- Mapped to Clerk user_id
  owner_user_id text not null references public.profiles(id) on delete cascade,

  provider text not null default 'razorpay',
  razorpay_subscription_id text unique,
  razorpay_customer_id text,
  razorpay_plan_id text,

  plan_key text not null,
  amount_paise bigint not null default 49900,
  currency text not null default 'INR',

  status text not null default 'not_started',
  provider_status text,

  trial_started_at timestamptz,
  trial_ends_at timestamptz,

  subscription_started_at timestamptz,

  current_period_start timestamptz,
  current_period_end timestamptz,
  next_charge_at timestamptz,

  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,

  last_payment_id text,
  last_payment_status text,
  last_payment_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Prevent multiple active subscriptions for the same workspace
  constraint one_active_sub_per_workspace unique (workspace_id)
);

-- Note: We drop the unique constraint for workspace_id to allow history, but maybe we just upsert the single subscription row per workspace to keep it simple.
-- Actually, it's better to keep one row per workspace or handle it gracefully. The requirement says:
-- "Add appropriate uniqueness so one workspace cannot accidentally create multiple concurrent subscriptions."
-- Using a partial index for active subscriptions is better, but since it's a 1:1 mapping in simple SaaS, `unique (workspace_id)` works well for upserting.

create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  subscription_id uuid references public.billing_subscriptions(id) on delete cascade,

  razorpay_payment_id text unique not null,
  razorpay_invoice_id text,

  amount_paise bigint not null,
  currency text not null default 'INR',

  status text not null,

  billing_period_start timestamptz,
  billing_period_end timestamptz,

  paid_at timestamptz,
  failed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'razorpay',
  provider_event_id text unique not null,
  event_type text not null,
  subscription_id text,
  payment_id text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'pending',
  payload_json jsonb,
  error_message text
);

alter table public.billing_subscriptions enable row level security;
alter table public.billing_payments enable row level security;
alter table public.billing_webhook_events enable row level security;

-- Admin only RLS (Server side accessed only using service_role)
create policy "billing_subscriptions select admin" on public.billing_subscriptions for select to authenticated using (owner_user_id = (select auth.jwt()->>'sub'));
create policy "billing_payments select admin" on public.billing_payments for select to authenticated using (workspace_id = (select auth.jwt()->>'sub'));

-- Trigger for updated_at
create trigger billing_subscriptions_touch_updated_at before update on public.billing_subscriptions for each row execute function public.touch_updated_at();
create trigger billing_payments_touch_updated_at before update on public.billing_payments for each row execute function public.touch_updated_at();
