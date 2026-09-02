-- 20260901000000_competitor_sync_status.sql
-- Add sync tracking and status fields to competitors table

ALTER TABLE public.competitors 
  ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'success', 'error')),
  ADD COLUMN IF NOT EXISTS sync_error text,
  ADD COLUMN IF NOT EXISTS first_sync_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ads_count integer DEFAULT -1;

-- Index for finding syncs by status
CREATE INDEX IF NOT EXISTS competitors_sync_status_idx ON public.competitors(user_id, sync_status);
CREATE INDEX IF NOT EXISTS competitors_first_sync_idx ON public.competitors(user_id, first_sync_completed_at DESC);

-- Existing index already covers most queries
-- competitors_user_idx is sufficient for most use cases
