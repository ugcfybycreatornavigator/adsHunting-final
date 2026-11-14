-- Hardened Distributed Rate Limiting RPC with parameter bounds and opportunistic cleanup
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_max integer,
  p_window_ms integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_reset_at timestamptz;
  v_count integer;
  v_window_interval interval;
  v_bounded_key text;
BEGIN
  -- 1. Input Validation & Bounds
  IF p_key IS NULL OR length(trim(p_key)) = 0 OR p_max <= 0 OR p_window_ms <= 0 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'retryAfter', 60,
      'error', 'INVALID_PARAMETERS'
    );
  END IF;

  -- Bound key length to 255 chars and window to max 24 hours
  v_bounded_key := substr(trim(p_key), 1, 255);
  v_window_interval := (LEAST(p_window_ms, 86400000) || ' milliseconds')::interval;

  -- 2. Opportunistic cleanup of expired buckets (~1% of requests)
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limit_buckets
    WHERE reset_at < v_now - interval '1 hour';
  END IF;

  -- 3. Atomic counter increment
  INSERT INTO public.rate_limit_buckets (key, count, reset_at)
  VALUES (v_bounded_key, 1, v_now + v_window_interval)
  ON CONFLICT (key) DO UPDATE
  SET 
    count = CASE 
      WHEN rate_limit_buckets.reset_at <= v_now THEN 1 
      ELSE rate_limit_buckets.count + 1 
    END,
    reset_at = CASE 
      WHEN rate_limit_buckets.reset_at <= v_now THEN v_now + v_window_interval 
      ELSE rate_limit_buckets.reset_at 
    END
  RETURNING count, reset_at INTO v_count, v_reset_at;

  -- 4. Threshold evaluation
  IF v_count > p_max THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'retryAfter', GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_reset_at - v_now))))
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'retryAfter', 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO authenticated;
