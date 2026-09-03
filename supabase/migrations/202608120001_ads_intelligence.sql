create extension if not exists pgcrypto;

create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  external_ad_id text not null unique,
  advertiser_id text not null,
  advertiser_name text not null,
  advertiser_avatar_url text,
  advertiser_profile_url text,
  body text,
  headline text,
  description text,
  cta text,
  landing_page_url text,
  source_media_url text,
  thumbnail_url text,
  stored_media_path text,
  media_type text not null default 'unknown' check (media_type in ('image','video','carousel','unknown')),
  status text not null check (status in ('active','inactive','unknown')),
  start_date timestamptz,
  stop_date timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  missing_checks integer not null default 0,
  running_days integer,
  country text,
  platforms text[] not null default '{}',
  snapshot_url text,
  source text not null default 'searchapi',
  variant_key text,
  raw_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_ads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ad_id uuid not null references public.ads(id) on delete cascade,
  notes text check (char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, ad_id)
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

create table if not exists public.collection_ads (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  saved_ad_id uuid not null references public.saved_ads(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(collection_id, saved_ad_id)
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now(),
  unique(user_id, name)
);

create table if not exists public.saved_ad_tags (
  saved_ad_id uuid not null references public.saved_ads(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(saved_ad_id, tag_id)
);

create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  advertiser_id text not null,
  advertiser_name text not null,
  advertiser_avatar_url text,
  created_at timestamptz not null default now(),
  last_synced_at timestamptz,
  unique(user_id, advertiser_id)
);

create table if not exists public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query text not null check (char_length(query) between 1 and 160),
  searched_at timestamptz not null default now()
);

create index if not exists ads_advertiser_idx on public.ads(advertiser_id);
create index if not exists ads_status_start_idx on public.ads(status, start_date desc);
create index if not exists ads_last_seen_idx on public.ads(last_seen_at desc);
create index if not exists ads_media_type_idx on public.ads(media_type);
create index if not exists ads_created_at_idx on public.ads(created_at desc);
create index if not exists ads_platforms_gin_idx on public.ads using gin(platforms);
create index if not exists ads_raw_data_gin_idx on public.ads using gin(raw_data jsonb_path_ops);
create index if not exists ads_search_idx on public.ads using gin(to_tsvector('simple', coalesce(advertiser_name,'') || ' ' || coalesce(headline,'') || ' ' || coalesce(body,'')));
create index if not exists saved_ads_user_created_idx on public.saved_ads(user_id, created_at desc);
create index if not exists collections_user_idx on public.collections(user_id, updated_at desc);
create index if not exists competitors_user_idx on public.competitors(user_id, created_at desc);
create index if not exists search_history_user_idx on public.search_history(user_id, searched_at desc);

alter table public.ads enable row level security;
alter table public.saved_ads enable row level security;
alter table public.collections enable row level security;
alter table public.collection_ads enable row level security;
alter table public.tags enable row level security;
alter table public.saved_ad_tags enable row level security;
alter table public.competitors enable row level security;
alter table public.search_history enable row level security;

create policy "authenticated users read catalogue" on public.ads for select to authenticated using (true);

create policy "users manage own saved ads" on public.saved_ads for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage own collections" on public.collections for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users read own collection links" on public.collection_ads for select to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()));
create policy "users insert own collection links" on public.collection_ads for insert to authenticated
  with check (
    exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()) and
    exists (select 1 from public.saved_ads s where s.id = saved_ad_id and s.user_id = auth.uid())
  );
create policy "users delete own collection links" on public.collection_ads for delete to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()));
create policy "users manage own tags" on public.tags for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage own saved ad tags" on public.saved_ad_tags for all to authenticated
  using (exists (select 1 from public.saved_ads s where s.id = saved_ad_id and s.user_id = auth.uid()))
  with check (
    exists (select 1 from public.saved_ads s where s.id = saved_ad_id and s.user_id = auth.uid()) and
    exists (select 1 from public.tags t where t.id = tag_id and t.user_id = auth.uid())
  );
create policy "users manage own competitors" on public.competitors for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage own searches" on public.search_history for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ad-creatives', 'ad-creatives', false, 41943040, array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
on conflict (id) do update set public = false;

-- No direct object read policy: authenticated saved-ad APIs issue short-lived signed URLs
-- after RLS verifies ownership. Global object paths allow true creative deduplication.

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists ads_touch_updated_at on public.ads;
create trigger ads_touch_updated_at before update on public.ads for each row execute function public.touch_updated_at();
drop trigger if exists saved_ads_touch_updated_at on public.saved_ads;
create trigger saved_ads_touch_updated_at before update on public.saved_ads for each row execute function public.touch_updated_at();
drop trigger if exists collections_touch_updated_at on public.collections;
create trigger collections_touch_updated_at before update on public.collections for each row execute function public.touch_updated_at();

-- A transient miss must not immediately deactivate an ad. Call this only after a verified page refresh.
create or replace function public.mark_verified_missing_ads(p_advertiser_id text, p_seen_external_ids text[])
returns void language sql security definer set search_path = public as $$
  update public.ads
  set missing_checks = missing_checks + 1,
      status = case when missing_checks + 1 >= 3 then 'inactive' else status end,
      stop_date = case when missing_checks + 1 >= 3 then coalesce(stop_date, now()) else stop_date end
  where advertiser_id = p_advertiser_id
    and status = 'active'
    and not (external_ad_id = any(p_seen_external_ids));
$$;
revoke all on function public.mark_verified_missing_ads(text, text[]) from public, anon, authenticated;
