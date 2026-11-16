create table if not exists public.meta_ads_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  connected_by_user_id text not null,
  meta_user_id text,
  ad_account_id text not null,
  ad_account_name text not null,
  currency text not null,
  timezone text not null,
  encrypted_access_token text not null,
  token_expires_at timestamptz,
  status text not null default 'active' check (status in ('active','expired','revoked','error')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, ad_account_id)
);
create index if not exists meta_ads_connections_workspace_idx on public.meta_ads_connections(workspace_id);
alter table public.meta_ads_connections enable row level security;
-- Tokens must never be readable through a browser Supabase client, even encrypted.
-- All reads and writes are mediated by authenticated server routes that scope the
-- service-role query to the Clerk workspace ID.
revoke all on public.meta_ads_connections from anon, authenticated;
grant all on public.meta_ads_connections to service_role;
