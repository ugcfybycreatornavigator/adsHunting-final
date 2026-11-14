-- Batch Competitor Active Ads Count RPC to eliminate N+1 queries
CREATE OR REPLACE FUNCTION public.get_competitor_active_counts(p_advertiser_ids text[])
RETURNS TABLE(advertiser_id text, active_ads bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.advertiser_id, count(*) as active_ads
  FROM public.ads a
  WHERE a.advertiser_id = ANY(p_advertiser_ids) AND a.status = 'active'
  GROUP BY a.advertiser_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_competitor_active_counts(text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_competitor_active_counts(text[]) TO authenticated;

