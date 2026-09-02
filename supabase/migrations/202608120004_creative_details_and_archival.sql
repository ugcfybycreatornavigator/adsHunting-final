alter table public.ads add column if not exists caption text;
alter table public.ads add column if not exists hashtags text[] not null default '{}';
alter table public.ads add column if not exists carousel_assets text[] not null default '{}';
alter table public.ads add column if not exists demographics jsonb;
alter table public.ads add column if not exists archive_status text not null default 'not_requested';

alter table public.ads drop constraint if exists ads_archive_status_check;
alter table public.ads add constraint ads_archive_status_check
  check (archive_status in ('not_requested', 'archived', 'failed', 'unavailable'));

create index if not exists ads_discover_creative_idx
  on public.ads(status, media_type, last_seen_at desc)
  where source_media_url is not null;
