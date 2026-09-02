-- Migration: 202608210002_search_brands_rpc.sql
-- Description: RPC function for Discover Brands view aggregation

CREATE OR REPLACE FUNCTION search_brands(query_text text DEFAULT NULL, max_results integer DEFAULT 40)
RETURNS TABLE (
  advertiser_id text,
  advertiser_name text,
  advertiser_avatar_url text,
  platforms text[],
  unique_ads bigint,
  active_ads bigint,
  preview_media text[],
  preview_thumbs text[]
) AS $$
BEGIN
  RETURN QUERY
  WITH brand_platforms AS (
    SELECT a.advertiser_id, unnest(a.platforms) as p
    FROM ads a
    WHERE (query_text IS NULL OR query_text = '' OR a.advertiser_name ILIKE '%' || query_text || '%')
  ),
  agg_platforms AS (
    SELECT bp.advertiser_id, array_agg(DISTINCT bp.p) as platforms
    FROM brand_platforms bp
    GROUP BY bp.advertiser_id
  )
  SELECT 
    a.advertiser_id,
    MAX(a.advertiser_name) as advertiser_name,
    MAX(a.advertiser_avatar_url) as advertiser_avatar_url,
    COALESCE(MAX(ap.platforms), ARRAY[]::text[]) as platforms,
    count(DISTINCT COALESCE(a.canonical_ad_id, a.id::text)) as unique_ads,
    count(DISTINCT CASE WHEN a.status = 'active' THEN COALESCE(a.canonical_ad_id, a.id::text) ELSE NULL END) as active_ads,
    (array_agg(a.source_media_url) FILTER (WHERE a.source_media_url IS NOT NULL))[1:3] as preview_media,
    (array_agg(a.thumbnail_url) FILTER (WHERE a.thumbnail_url IS NOT NULL))[1:3] as preview_thumbs
  FROM ads a
  LEFT JOIN agg_platforms ap ON a.advertiser_id = ap.advertiser_id
  WHERE (query_text IS NULL OR query_text = '' OR a.advertiser_name ILIKE '%' || query_text || '%')
  GROUP BY a.advertiser_id
  ORDER BY unique_ads DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
