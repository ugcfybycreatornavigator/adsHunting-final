-- Migration: Add visibility to shared ad links
-- Description: Adds a visibility column to shared_ad_links to support 'public' and 'private' modes. Defaults to 'private' for existing links.

alter table public.shared_ad_links 
add column if not exists visibility text not null default 'private' check (visibility in ('public', 'private'));
