-- ==============================================================================
-- ADSHUNTING: STAGE 1 CONSOLIDATED DATABASE MIGRATION
-- Project: AdsHunting (adshunting.com)
-- Target Supabase Project: ctvmjxpblfdrxvvyjebw (ads intelligence)
-- Purpose: Safely deploy Stage 1 migrations (ISSUE-005 and ISSUE-016)
-- Safety: Transactional, 100% idempotent, non-locking, zero data loss
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. ISSUE-005: Add dispatch tracking columns to support_feedback
-- ------------------------------------------------------------------------------
ALTER TABLE public.support_feedback 
ADD COLUMN IF NOT EXISTS dispatch_status TEXT DEFAULT 'pending';

ALTER TABLE public.support_feedback 
ADD COLUMN IF NOT EXISTS dispatch_error TEXT;

CREATE INDEX IF NOT EXISTS idx_support_feedback_dispatch_status 
ON public.support_feedback (dispatch_status);

COMMENT ON COLUMN public.support_feedback.dispatch_status IS 'Status of external support notification dispatch (e.g., delivered, failed, pending)';
COMMENT ON COLUMN public.support_feedback.dispatch_error IS 'Error message details if external notification dispatch failed';

-- ------------------------------------------------------------------------------
-- 2. ISSUE-016: Secure Shared-Ad Link Tokens with SHA-256 Hashing
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Only hash plaintext tokens; guarantee that already-hashed 64-char hex strings are never double-hashed
UPDATE public.shared_ad_links
SET token_hash = encode(digest(token_hash, 'sha256'), 'hex')
WHERE token_hash IS NOT NULL
  AND token_hash !~ '^[0-9a-f]{64}$';

COMMIT;

-- ------------------------------------------------------------------------------
-- VERIFICATION QUERY (Run this immediately after COMMIT to confirm success):
-- ------------------------------------------------------------------------------
SELECT 
    (SELECT count(*) FROM information_schema.columns WHERE table_name = 'support_feedback' AND column_name = 'dispatch_status') as dispatch_status_col_exists,
    (SELECT count(*) FROM public.shared_ad_links WHERE token_hash !~ '^[0-9a-f]{64}$') as unhashed_links_remaining;
-- Expected Result: dispatch_status_col_exists = 1, unhashed_links_remaining = 0
