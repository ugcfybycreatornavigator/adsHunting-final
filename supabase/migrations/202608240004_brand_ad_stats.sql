
CREATE OR REPLACE FUNCTION public.get_brand_ad_stats(p_advertiser_ids text[])
RETURNS TABLE (
  advertiser_id text,
  total_ads bigint,
  active_ads bigint,
  latest_activity_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    a.advertiser_id,
    COUNT(DISTINCT COALESCE(NULLIF(a.canonical_ad_id, ''), a.id::text)) as total_ads,
    COUNT(DISTINCT CASE WHEN a.status = 'active' THEN COALESCE(NULLIF(a.canonical_ad_id, ''), a.id::text) ELSE NULL END) as active_ads,
    MAX(a.last_seen_at) as latest_activity_at
  FROM public.ads a
  WHERE a.advertiser_id = ANY(p_advertiser_ids)
  GROUP BY a.advertiser_id;
$$;

