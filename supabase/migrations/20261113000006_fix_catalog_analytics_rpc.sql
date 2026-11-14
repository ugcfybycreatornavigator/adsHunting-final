-- Fix catalog analytics aggregation RPC to avoid nested aggregate calls
CREATE OR REPLACE FUNCTION public.get_catalog_analytics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_active bigint;
  v_avg_duration integer;
  v_long_runners bigint;
  v_media jsonb;
  v_ctas jsonb;
  v_platforms jsonb;
  v_launches jsonb;
  v_now timestamptz := now();
BEGIN
  -- Basic metrics
  SELECT 
    count(*),
    count(*) FILTER (WHERE status = 'active'),
    coalesce(round(avg(running_days) FILTER (WHERE running_days IS NOT NULL)), 0)::integer,
    count(*) FILTER (WHERE status = 'active' AND coalesce(running_days, 0) >= 30)
  INTO v_total, v_active, v_avg_duration, v_long_runners
  FROM public.ads;

  -- Media distribution
  SELECT coalesce(jsonb_object_agg(media_type, cnt), '{}'::jsonb)
  INTO v_media
  FROM (
    SELECT media_type, count(*) as cnt
    FROM public.ads
    WHERE media_type IS NOT NULL AND media_type != ''
    GROUP BY media_type
    ORDER BY cnt DESC
    LIMIT 20
  ) m;

  -- CTA patterns
  SELECT coalesce(jsonb_object_agg(cta, cnt), '{}'::jsonb)
  INTO v_ctas
  FROM (
    SELECT cta, count(*) as cnt
    FROM public.ads
    WHERE cta IS NOT NULL AND cta != ''
    GROUP BY cta
    ORDER BY cnt DESC
    LIMIT 20
  ) c;

  -- Platforms mix
  SELECT coalesce(jsonb_object_agg(platform, cnt), '{}'::jsonb)
  INTO v_platforms
  FROM (
    SELECT unnest(platforms) as platform, count(*) as cnt
    FROM public.ads
    WHERE platforms IS NOT NULL
    GROUP BY platform
    ORDER BY cnt DESC
    LIMIT 20
  ) p;

  -- 8 Weekly launch velocity buckets
  WITH weeks AS (
    SELECT 
      gs as week_idx,
      v_now - ((7 - gs) * interval '7 days') as week_start,
      v_now - ((6 - gs) * interval '7 days') as week_end
    FROM generate_series(0, 7) gs
  ),
  weekly_counts AS (
    SELECT 
      w.week_idx,
      to_char(w.week_start, 'Mon DD') as label,
      count(a.id)::int as cnt
    FROM weeks w
    LEFT JOIN public.ads a ON a.start_date >= w.week_start AND a.start_date < w.week_end
    GROUP BY w.week_idx, w.week_start
    ORDER BY w.week_idx
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'label', label,
      'value', cnt
    ) ORDER BY week_idx
  ), '[]'::jsonb)
  INTO v_launches
  FROM weekly_counts;

  RETURN jsonb_build_object(
    'total', coalesce(v_total, 0),
    'active', coalesce(v_active, 0),
    'avgDuration', coalesce(v_avg_duration, 0),
    'longRunners', coalesce(v_long_runners, 0),
    'media', v_media,
    'ctas', v_ctas,
    'platforms', v_platforms,
    'launches', v_launches
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_catalog_analytics() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_catalog_analytics() TO authenticated;
