-- Update the get_search_suggestions function to include advertiser_avatar_url
-- We use DROP FUNCTION IF EXISTS because we are modifying the RETURNS TABLE signature,
-- which PostgreSQL requires when adding new columns to the output.

DROP FUNCTION IF EXISTS public.get_search_suggestions(text, int);

CREATE OR REPLACE FUNCTION public.get_search_suggestions(search_query text, max_limit int)
RETURNS TABLE (
  id text,
  type text,
  label text,
  normalized_label text,
  active_ad_count bigint,
  advertiser_avatar_url text
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  -- Exact or prefix brand matches from ads
  SELECT
    max(advertiser_id) as id,
    'brand' as type,
    advertiser_name as label,
    lower(advertiser_name) as normalized_label,
    count(*) filter (where status = 'active') as active_ad_count,
    (array_agg(advertiser_avatar_url) filter (where advertiser_avatar_url is not null))[1] as advertiser_avatar_url
  FROM public.ads
  WHERE advertiser_name ILIKE search_query || '%'
  GROUP BY advertiser_name
  ORDER BY active_ad_count DESC, advertiser_name ASC
  LIMIT max_limit;
$$;
