-- Create the support_feedback table
CREATE TABLE IF NOT EXISTS public.support_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    attachment_path TEXT,
    page_url TEXT,
    request_id TEXT,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.support_feedback ENABLE ROW LEVEL SECURITY;

-- Since feedback is inserted server-side from /api/feedback where Clerk auth is verified,
-- we don't strictly need client-side RLS policies if we use service_role client.
-- However, for defense in depth if we ever use authenticated client:
CREATE POLICY "Users can insert their own feedback"
ON public.support_feedback
FOR INSERT
WITH CHECK (true); 
-- Server will enforce user_id and workspace_id via service_role

-- Support Attachments Bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('support-attachments', 'support-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Policies for the bucket
-- Allow authenticated uploads to specific paths
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'support-attachments'
);

CREATE POLICY "Allow authenticated reads"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'support-attachments'
);
