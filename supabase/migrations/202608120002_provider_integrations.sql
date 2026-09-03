-- Allow providers to preserve an explicit unknown lifecycle state rather than
-- fabricating active/inactive when their response does not confirm it.
alter table public.ads drop constraint if exists ads_status_check;
alter table public.ads add constraint ads_status_check check (status in ('active', 'inactive', 'unknown'));

create index if not exists ads_source_status_idx on public.ads(source, status, last_seen_at desc);
