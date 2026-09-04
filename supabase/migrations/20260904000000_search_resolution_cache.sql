CREATE TABLE IF NOT EXISTS public.search_resolution_cache (
  query_text text primary key,
  provider_brand_id text not null,
  canonical_name text not null,
  logo_url text,
  last_resolved_at timestamptz not null default now()
);
