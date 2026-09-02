-- Migration: Single Active Session
-- Purpose: Enforce one active Clerk session per user.

CREATE TABLE IF NOT EXISTS public.user_active_sessions (
    user_id TEXT PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    active_session_id TEXT NOT NULL,
    session_created_at TIMESTAMPTZ NOT NULL,
    activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_active_sessions ENABLE ROW LEVEL SECURITY;

-- No client policies. Server-only access via service_role key.

-- Atomic activation RPC
-- Returns true if this session was successfully activated (it is the newest).
-- Returns false if a newer session already exists and this one should be rejected.
CREATE OR REPLACE FUNCTION public.activate_session_if_newer(
    p_user_id TEXT,
    p_session_id TEXT,
    p_session_created_at TIMESTAMPTZ
) RETURNS BOOLEAN AS $$
DECLARE
    v_existing_created_at TIMESTAMPTZ;
BEGIN
    -- Attempt to get the current active session creation time, locking the row for update
    SELECT session_created_at INTO v_existing_created_at
    FROM public.user_active_sessions
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- No existing session, safe to insert
        INSERT INTO public.user_active_sessions (user_id, active_session_id, session_created_at)
        VALUES (p_user_id, p_session_id, p_session_created_at);
        RETURN TRUE;
    END IF;

    -- If the incoming session is strictly older than the existing one, reject it.
    -- (If they are equal, we also reject to avoid continuous flip-flopping, 
    -- unless it's the exact same session_id being re-activated which is fine).
    IF p_session_created_at < v_existing_created_at THEN
        RETURN FALSE;
    END IF;
    
    IF p_session_created_at = v_existing_created_at THEN
        -- Tie-breaker: If it's the exact same session, we can just return true.
        -- If it's a different session ID but exact same millisecond, we can use 
        -- alphabetical sorting of session ID as a deterministic tie-breaker.
        DECLARE
            v_existing_session_id TEXT;
        BEGIN
            SELECT active_session_id INTO v_existing_session_id
            FROM public.user_active_sessions
            WHERE user_id = p_user_id;

            IF v_existing_session_id = p_session_id THEN
                RETURN TRUE;
            ELSIF p_session_id < v_existing_session_id THEN
                RETURN FALSE;
            END IF;
        END;
    END IF;

    -- Incoming session is newer (or won the tie-breaker). Update the record.
    UPDATE public.user_active_sessions
    SET active_session_id = p_session_id,
        session_created_at = p_session_created_at,
        activated_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
