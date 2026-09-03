create table if not exists public.shared_ad_links (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  message text check (char_length(message) <= 1000),
  token_hash text not null unique,
  content_type text not null check (content_type in ('single', 'multiple', 'swipe_file')),
  swipe_file_id uuid references public.collections(id) on delete set null,
  expires_at timestamptz,
  revoked_at timestamptz,
  allow_save boolean not null default false,
  allow_download boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_viewed_at timestamptz
);

create table if not exists public.shared_ad_items (
  id uuid primary key default gen_random_uuid(),
  shared_link_id uuid not null references public.shared_ad_links(id) on delete cascade,
  ad_id uuid not null references public.ads(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique(shared_link_id, ad_id)
);

create table if not exists public.shared_ad_access_events (
  id uuid primary key default gen_random_uuid(),
  shared_link_id uuid not null references public.shared_ad_links(id) on delete cascade,
  viewer_user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('opened', 'viewed_ad', 'played_video', 'saved_ad', 'downloaded_ad')),
  safe_metadata jsonb,
  created_at timestamptz not null default now()
);

-- Triggers for updated_at
drop trigger if exists shared_ad_links_touch_updated_at on public.shared_ad_links;
create trigger shared_ad_links_touch_updated_at before update on public.shared_ad_links for each row execute function public.touch_updated_at();

-- Indexes
create index if not exists shared_ad_links_owner_idx on public.shared_ad_links(owner_user_id, created_at desc);
create index if not exists shared_ad_links_token_hash_idx on public.shared_ad_links(token_hash);
create index if not exists shared_ad_items_link_idx on public.shared_ad_items(shared_link_id, position asc);
create index if not exists shared_ad_access_events_link_idx on public.shared_ad_access_events(shared_link_id, created_at desc);

-- RLS
alter table public.shared_ad_links enable row level security;
alter table public.shared_ad_items enable row level security;
alter table public.shared_ad_access_events enable row level security;

create policy "users manage own shared links" on public.shared_ad_links for all to authenticated
  using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);

create policy "users read own shared link items" on public.shared_ad_items for select to authenticated
  using (exists (select 1 from public.shared_ad_links s where s.id = shared_link_id and s.owner_user_id = auth.uid()));

create policy "users insert own shared link items" on public.shared_ad_items for insert to authenticated
  with check (exists (select 1 from public.shared_ad_links s where s.id = shared_link_id and s.owner_user_id = auth.uid()));

create policy "users delete own shared link items" on public.shared_ad_items for delete to authenticated
  using (exists (select 1 from public.shared_ad_links s where s.id = shared_link_id and s.owner_user_id = auth.uid()));

create policy "users read own shared link activity" on public.shared_ad_access_events for select to authenticated
  using (exists (select 1 from public.shared_ad_links s where s.id = shared_link_id and s.owner_user_id = auth.uid()));
