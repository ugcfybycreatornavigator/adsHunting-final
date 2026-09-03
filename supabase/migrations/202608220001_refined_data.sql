-- Add refined_data JSONB column to support the new nested RefinedAd schema
ALTER TABLE public.ads 
ADD COLUMN IF NOT EXISTS refined_data JSONB DEFAULT '{}'::jsonb;

-- Add quality_score for sorting by Ad Quality
ALTER TABLE public.ads 
ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0;

-- Ensure an index on quality_score for efficient sorting
CREATE INDEX IF NOT EXISTS idx_ads_quality_score ON public.ads (quality_score DESC);
