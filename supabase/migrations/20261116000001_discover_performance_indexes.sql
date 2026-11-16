-- High-performance composite and partial indexes for AdsHunting Discover and Search queries

-- 1. Accelerates default Discover feed pagination (ordered by last_seen_at desc, canonical_ad_id asc)
create index if not exists ads_discovery_last_seen_idx
  on public.ads (last_seen_at desc, canonical_ad_id asc)
  where advertiser_name is not null and advertiser_name != '';

-- 2. Accelerates "Most recent" sorting queries
create index if not exists ads_discovery_start_date_idx
  on public.ads (start_date desc nulls last, canonical_ad_id asc)
  where advertiser_name is not null and advertiser_name != '';

-- 3. Accelerates "Longest running" sorting queries
create index if not exists ads_discovery_running_days_idx
  on public.ads (running_days desc nulls last, canonical_ad_id asc)
  where advertiser_name is not null and advertiser_name != '';
