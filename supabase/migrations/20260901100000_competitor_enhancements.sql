-- 20260901100000_competitor_enhancements.sql
-- Add tracking status column for pause/resume functionality

-- Only add if not exists (the column may not exist yet)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'competitors' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.competitors ADD COLUMN status text DEFAULT 'tracking' CHECK (status IN ('tracking', 'paused', 'error'));
  END IF;
END
$$;

-- Ensure last_synced_at exists (it should from initial migration, but safety check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'competitors' AND column_name = 'last_synced_at'
  ) THEN
    ALTER TABLE public.competitors ADD COLUMN last_synced_at timestamptz;
  END IF;
END
$$;
