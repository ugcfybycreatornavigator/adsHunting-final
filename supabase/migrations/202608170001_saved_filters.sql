-- Migration: Saved Filters
-- Requirements:
-- 1. Table `user_saved_filters` with required columns.
-- 2. `user_id` as text referencing `public.profiles(id)` since auth uses Clerk IDs.
-- 3. RLS policies using `auth.jwt()->>'sub'`.

create table if not exists public.user_saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 500),
  filters jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

-- Unique index to ensure only one default filter per user
create unique index if not exists user_saved_filters_default_idx on public.user_saved_filters(user_id) where is_default = true;

alter table public.user_saved_filters enable row level security;

-- Policies mirroring the Clerk auth setup
create policy "users manage own saved filters" on public.user_saved_filters
  for all to authenticated
  using ((select auth.jwt()->>'sub') = user_id)
  with check ((select auth.jwt()->>'sub') = user_id);

-- Add updated_at trigger
drop trigger if exists user_saved_filters_touch_updated_at on public.user_saved_filters;
create trigger user_saved_filters_touch_updated_at
  before update on public.user_saved_filters
  for each row execute function public.touch_updated_at();
