-- Migration: Clerk Authentication & Profiles Setup
-- Strategy: Option A (Text Clerk User IDs directly for fast execution & safe RLS)

-- 1. Drop old policies depending on user_id before altering column types
drop policy if exists "users manage own saved ads" on public.saved_ads;
drop policy if exists "users manage own collections" on public.collections;
drop policy if exists "users read own collection links" on public.collection_ads;
drop policy if exists "users insert own collection links" on public.collection_ads;
drop policy if exists "users delete own collection links" on public.collection_ads;
drop policy if exists "users manage own tags" on public.tags;
drop policy if exists "users manage own saved ad tags" on public.saved_ad_tags;
drop policy if exists "users manage own competitors" on public.competitors;
drop policy if exists "users manage own searches" on public.search_history;

-- 2. Create profiles table for Clerk user synchronization
create table if not exists public.profiles (
  id text primary key, -- Clerk User ID (e.g. user_xxx)
  clerk_user_id text unique not null,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

alter table public.profiles enable row level security;

-- Profiles RLS
drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles
  for select to authenticated
  using ((select auth.jwt()->>'sub') = clerk_user_id);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update to authenticated
  using ((select auth.jwt()->>'sub') = clerk_user_id)
  with check ((select auth.jwt()->>'sub') = clerk_user_id);

-- 3. Modify resource table user_id columns to text (Clerk User ID)
-- Drop existing foreign keys to auth.users(id)
alter table public.saved_ads drop constraint if exists saved_ads_user_id_fkey;
alter table public.collections drop constraint if exists collections_user_id_fkey;
alter table public.tags drop constraint if exists tags_user_id_fkey;
alter table public.competitors drop constraint if exists competitors_user_id_fkey;
alter table public.search_history drop constraint if exists search_history_user_id_fkey;

-- Change column types to text
alter table public.saved_ads alter column user_id type text using user_id::text;
alter table public.collections alter column user_id type text using user_id::text;
alter table public.tags alter column user_id type text using user_id::text;
alter table public.competitors alter column user_id type text using user_id::text;
alter table public.search_history alter column user_id type text using user_id::text;

-- Re-add foreign keys targeting public.profiles(id)
alter table public.saved_ads add constraint saved_ads_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.collections add constraint collections_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.tags add constraint tags_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.competitors add constraint competitors_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.search_history add constraint search_history_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

-- 4. Re-create RLS policies using auth.jwt()->>'sub'
create policy "users manage own saved ads" on public.saved_ads for all to authenticated
  using ((select auth.jwt()->>'sub') = user_id) with check ((select auth.jwt()->>'sub') = user_id);

create policy "users manage own collections" on public.collections for all to authenticated
  using ((select auth.jwt()->>'sub') = user_id) with check ((select auth.jwt()->>'sub') = user_id);

create policy "users read own collection links" on public.collection_ads for select to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = (select auth.jwt()->>'sub')));

create policy "users insert own collection links" on public.collection_ads for insert to authenticated
  with check (
    exists (select 1 from public.collections c where c.id = collection_id and c.user_id = (select auth.jwt()->>'sub')) and
    exists (select 1 from public.saved_ads s where s.id = saved_ad_id and s.user_id = (select auth.jwt()->>'sub'))
  );

create policy "users delete own collection links" on public.collection_ads for delete to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = (select auth.jwt()->>'sub')));

create policy "users manage own tags" on public.tags for all to authenticated
  using ((select auth.jwt()->>'sub') = user_id) with check ((select auth.jwt()->>'sub') = user_id);

create policy "users manage own saved ad tags" on public.saved_ad_tags for all to authenticated
  using (exists (select 1 from public.saved_ads s where s.id = saved_ad_id and s.user_id = (select auth.jwt()->>'sub')))
  with check (
    exists (select 1 from public.saved_ads s where s.id = saved_ad_id and s.user_id = (select auth.jwt()->>'sub')) and
    exists (select 1 from public.tags t where t.id = tag_id and t.user_id = (select auth.jwt()->>'sub'))
  );

create policy "users manage own competitors" on public.competitors for all to authenticated
  using ((select auth.jwt()->>'sub') = user_id) with check ((select auth.jwt()->>'sub') = user_id);

create policy "users manage own searches" on public.search_history for all to authenticated
  using ((select auth.jwt()->>'sub') = user_id) with check ((select auth.jwt()->>'sub') = user_id);

-- Profile touch trigger
drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_updated_at();
