-- 202608210001_canonical_ad_deduplication.sql

ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS canonical_ad_id text UNIQUE;
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS creative_fingerprint text;
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS creative_group_id text;
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS observation_count integer not null default 1;
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS provider_ad_ids text[] not null default '{}';

-- Drop the single external_ad_id unique constraint, as we now merge multiple external IDs into one canonical ad
ALTER TABLE public.ads DROP CONSTRAINT IF EXISTS ads_external_ad_id_key;

-- We still want fast lookups on external_ad_id just in case, but canonical_ad_id is the primary uniqueness vector now
CREATE INDEX IF NOT EXISTS ads_canonical_idx ON public.ads(canonical_ad_id);
CREATE INDEX IF NOT EXISTS ads_group_idx ON public.ads(creative_group_id);
CREATE INDEX IF NOT EXISTS ads_provider_ids_idx ON public.ads USING gin(provider_ad_ids);

-- Update the missing ads checker to use the array overlap operator
CREATE OR REPLACE FUNCTION public.mark_verified_missing_ads(p_advertiser_id text, p_seen_external_ids text[])
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.ads
  SET missing_checks = missing_checks + 1,
      status = case when missing_checks + 1 >= 3 then 'inactive' else status end,
      stop_date = case when missing_checks + 1 >= 3 then coalesce(stop_date, now()) else stop_date end
  WHERE advertiser_id = p_advertiser_id
    AND status = 'active'
    AND NOT (provider_ad_ids && p_seen_external_ids);
$$;
