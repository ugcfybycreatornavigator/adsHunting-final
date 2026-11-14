-- Distributed Rate Limiting via atomic PostgreSQL UPSERT
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 1,
  reset_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_reset_at ON public.rate_limit_buckets(reset_at);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

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
  v_window_interval interval := (p_window_ms || ' milliseconds')::interval;
BEGIN
  INSERT INTO public.rate_limit_buckets (key, count, reset_at)
  VALUES (p_key, 1, v_now + v_window_interval)
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

