-- Refine credit tracking schema for unified idempotency and atomic base+delivery charges
ALTER TABLE public.credit_usage_events ALTER COLUMN ad_id DROP NOT NULL;
ALTER TABLE public.credit_usage_events ADD COLUMN IF NOT EXISTS idempotency_key text;

UPDATE public.credit_usage_events SET idempotency_key = ad_id WHERE idempotency_key IS NULL;
ALTER TABLE public.credit_usage_events ALTER COLUMN idempotency_key SET NOT NULL;

ALTER TABLE public.credit_usage_events DROP CONSTRAINT IF EXISTS uq_credit_usage_event;
ALTER TABLE public.credit_usage_events ADD CONSTRAINT uq_credit_usage_event UNIQUE (workspace_id, search_session_id, idempotency_key, event_type);

-- Unified RPC for both base search charge and batch delivery charge in one atomic transaction
CREATE OR REPLACE FUNCTION public.report_search_and_delivery_usage(
  p_workspace_id text,
  p_user_id text,
  p_search_session_id text,
  p_base_event_type text,
  p_base_fingerprint text,
  p_base_cost integer,
  p_delivery_event_type text,
  p_delivery_ad_ids text[],
  p_delivery_cost integer,
  p_metadata jsonb default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_record record;
  v_ad_id text;
  v_actually_charged integer := 0;
  v_remaining_before integer;
  v_accepted_ad_ids text[] := '{}';
  v_base_charged boolean := false;
  v_inserted boolean;
BEGIN
  -- 1. Lock active billing cycle
  SELECT * INTO v_balance_record
  FROM public.workspace_credit_balances
  WHERE workspace_id = p_workspace_id AND cycle_end > now()
  ORDER BY cycle_start desc
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_ACTIVE_CYCLE', 'message', 'No active billing cycle found.', 'creditsRemaining', 0);
  END IF;

  v_remaining_before := v_balance_record.credits_allocated - v_balance_record.credits_used;

  -- 2. Process Base Charge Idempotently
  IF p_base_cost > 0 AND p_base_fingerprint IS NOT NULL THEN
    IF v_remaining_before < p_base_cost THEN
      RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_CREDITS', 'message', 'Insufficient credits for base search.', 'creditsRemaining', v_remaining_before, 'exhausted', true);
    END IF;

    -- ON CONFLICT DO NOTHING makes it idempotent without catching exceptions
    INSERT INTO public.credit_usage_events (
      workspace_id, user_id, search_session_id, event_type, idempotency_key, credits, billing_cycle_id, metadata
    ) VALUES (
      p_workspace_id, p_user_id, p_search_session_id, p_base_event_type, p_base_fingerprint, p_base_cost, v_balance_record.id, p_metadata
    )
    ON CONFLICT (workspace_id, search_session_id, idempotency_key, event_type) DO NOTHING
    RETURNING true INTO v_inserted;

    IF v_inserted THEN
      v_actually_charged := v_actually_charged + p_base_cost;
      v_base_charged := true;
    END IF;
  END IF;

  -- 3. Process Delivery Charges
  IF array_length(p_delivery_ad_ids, 1) > 0 THEN
    FOREACH v_ad_id IN ARRAY p_delivery_ad_ids LOOP
      -- Check affordability for this ad
      IF (v_balance_record.credits_allocated - (v_balance_record.credits_used + v_actually_charged)) < p_delivery_cost THEN
        CONTINUE;
      END IF;

      INSERT INTO public.credit_usage_events (
        workspace_id, user_id, search_session_id, ad_id, event_type, idempotency_key, credits, billing_cycle_id, metadata
      ) VALUES (
        p_workspace_id, p_user_id, p_search_session_id, v_ad_id, p_delivery_event_type, v_ad_id, p_delivery_cost, v_balance_record.id, p_metadata
      )
      ON CONFLICT (workspace_id, search_session_id, idempotency_key, event_type) DO NOTHING
      RETURNING true INTO v_inserted;

      IF v_inserted THEN
        v_actually_charged := v_actually_charged + p_delivery_cost;
        v_accepted_ad_ids := array_append(v_accepted_ad_ids, v_ad_id);
      END IF;
    END LOOP;
  END IF;

  -- 4. Update Balance
  IF v_actually_charged > 0 THEN
    UPDATE public.workspace_credit_balances
    SET credits_used = credits_used + v_actually_charged,
        updated_at = now()
    WHERE id = v_balance_record.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'creditsChargedThisRequest', v_actually_charged,
    'baseCharged', v_base_charged,
    'acceptedAdIds', v_accepted_ad_ids,
    'creditsRemaining', v_balance_record.credits_allocated - (v_balance_record.credits_used + v_actually_charged),
    'creditsAllocated', v_balance_record.credits_allocated,
    'creditsUsed', v_balance_record.credits_used + v_actually_charged,
    'exhausted', (v_balance_record.credits_allocated - (v_balance_record.credits_used + v_actually_charged)) <= 0
  );
END;
$$;
