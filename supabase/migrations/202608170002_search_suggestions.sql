-- Add pg_trgm extension if not exists
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create an index on advertiser_name for faster fuzzy/prefix searches if not exists
CREATE INDEX IF NOT EXISTS ads_advertiser_name_trgm_idx ON public.ads USING gin (advertiser_name gin_trgm_ops);

-- Create a function to get search suggestions quickly
CREATE OR REPLACE FUNCTION public.get_search_suggestions(search_query text, max_limit int)
RETURNS TABLE (
  id text,
  type text,
  label text,
  normalized_label text,
  active_ad_count bigint
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  -- Exact or prefix brand matches from ads
  SELECT
    max(advertiser_id) as id,
    'brand' as type,
    advertiser_name as label,
    lower(advertiser_name) as normalized_label,
    count(*) filter (where status = 'active') as active_ad_count
  FROM public.ads
  WHERE advertiser_name ILIKE search_query || '%'
  GROUP BY advertiser_name
  ORDER BY active_ad_count DESC, advertiser_name ASC
  LIMIT max_limit;
$$;
