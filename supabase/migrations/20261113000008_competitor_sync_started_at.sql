ALTER TABLE public.competitors
  ADD COLUMN IF NOT EXISTS sync_started_at timestamptz;

CREATE INDEX IF NOT EXISTS competitors_sync_started_at_idx
  ON public.competitors (sync_started_at)
  WHERE sync_status = 'syncing';
