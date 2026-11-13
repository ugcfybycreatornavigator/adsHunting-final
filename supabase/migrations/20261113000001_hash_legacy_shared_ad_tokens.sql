CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

UPDATE public.shared_ad_links
SET token_hash = encode(extensions.digest(token_hash::bytea, 'sha256'), 'hex')
WHERE token_hash IS NOT NULL
  AND token_hash !~ '^[0-9a-f]{64}$';
