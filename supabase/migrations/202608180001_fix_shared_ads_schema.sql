-- Migration: Fix Shared Ads Schema for Clerk Profiles
-- Description: Changes UUID owner/viewer columns to TEXT to support Clerk user IDs and uses public.profiles. Updates RLS policies to use auth.jwt()->>'sub'.

-- 1. Drop existing RLS policies
drop policy if exists "users manage own shared links" on public.shared_ad_links;
drop policy if exists "users read own shared link items" on public.shared_ad_items;
drop policy if exists "users insert own shared link items" on public.shared_ad_items;
drop policy if exists "users delete own shared link items" on public.shared_ad_items;
drop policy if exists "users read own shared link activity" on public.shared_ad_access_events;

-- 2. Drop existing foreign keys to auth.users(id)
alter table public.shared_ad_links drop constraint if exists shared_ad_links_owner_user_id_fkey;
alter table public.shared_ad_access_events drop constraint if exists shared_ad_access_events_viewer_user_id_fkey;

-- 3. Change column types to text
alter table public.shared_ad_links alter column owner_user_id type text using owner_user_id::text;
alter table public.shared_ad_access_events alter column viewer_user_id type text using viewer_user_id::text;

-- 4. Re-add foreign keys targeting public.profiles(id)
alter table public.shared_ad_links add constraint shared_ad_links_owner_user_id_fkey foreign key (owner_user_id) references public.profiles(id) on delete cascade;
alter table public.shared_ad_access_events add constraint shared_ad_access_events_viewer_user_id_fkey foreign key (viewer_user_id) references public.profiles(id) on delete cascade;

-- 5. Re-create RLS policies using auth.jwt()->>'sub'
create policy "users manage own shared links" on public.shared_ad_links for all to authenticated
  using ((select auth.jwt()->>'sub') = owner_user_id) with check ((select auth.jwt()->>'sub') = owner_user_id);

create policy "users read own shared link items" on public.shared_ad_items for select to authenticated
  using (exists (select 1 from public.shared_ad_links s where s.id = shared_link_id and s.owner_user_id = (select auth.jwt()->>'sub')));

create policy "users insert own shared link items" on public.shared_ad_items for insert to authenticated
  with check (exists (select 1 from public.shared_ad_links s where s.id = shared_link_id and s.owner_user_id = (select auth.jwt()->>'sub')));

create policy "users delete own shared link items" on public.shared_ad_items for delete to authenticated
  using (exists (select 1 from public.shared_ad_links s where s.id = shared_link_id and s.owner_user_id = (select auth.jwt()->>'sub')));

create policy "users read own shared link activity" on public.shared_ad_access_events for select to authenticated
  using (exists (select 1 from public.shared_ad_links s where s.id = shared_link_id and s.owner_user_id = (select auth.jwt()->>'sub')));
