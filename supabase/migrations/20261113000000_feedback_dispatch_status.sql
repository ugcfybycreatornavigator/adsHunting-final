-- Migration: Add dispatch tracking columns to support_feedback
-- For ISSUE-005: Distinguish local feedback recording from upstream dispatch status

ALTER TABLE public.support_feedback 
ADD COLUMN IF NOT EXISTS dispatch_status TEXT DEFAULT 'pending';

ALTER TABLE public.support_feedback 
ADD COLUMN IF NOT EXISTS dispatch_error TEXT;

COMMENT ON COLUMN public.support_feedback.dispatch_status IS 'Status of external support notification dispatch (e.g., delivered, failed, pending)';
COMMENT ON COLUMN public.support_feedback.dispatch_error IS 'Error message details if external notification dispatch failed';
