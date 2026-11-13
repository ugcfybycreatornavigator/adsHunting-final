-- Migration: Hash Legacy Plaintext Shared Ad Tokens
-- For ISSUE-016: Shared-Ad Token Security
-- Converts any legacy unhashed tokens into SHA-256 hex digests.
-- Idempotent: Skips any row that already contains a 64-character hex digest.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE public.shared_ad_links
SET token_hash = encode(digest(token_hash, 'sha256'), 'hex'),
    updated_at = NOW()
WHERE token_hash !~ '^[0-9a-f]{64}$';

COMMENT ON COLUMN public.shared_ad_links.token_hash IS 'SHA-256 hex digest of the raw high-entropy sharing token';
