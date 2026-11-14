-- Fix saved_ad_tags foreign key and RLS to reference swipe_file_items after consolidation
ALTER TABLE public.saved_ad_tags DROP CONSTRAINT IF EXISTS saved_ad_tags_saved_ad_id_fkey;
ALTER TABLE public.saved_ad_tags ADD CONSTRAINT saved_ad_tags_saved_ad_id_fkey
  FOREIGN KEY (saved_ad_id) REFERENCES public.swipe_file_items(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "users manage own saved ad tags" ON public.saved_ad_tags;
CREATE POLICY "users manage own saved ad tags" ON public.saved_ad_tags FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.swipe_file_items sfi
      JOIN public.swipe_files sf ON sf.id = sfi.swipe_file_id
      WHERE sfi.id = saved_ad_id AND sf.user_id = auth.jwt()->>'sub'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.swipe_file_items sfi
      JOIN public.swipe_files sf ON sf.id = sfi.swipe_file_id
      WHERE sfi.id = saved_ad_id AND sf.user_id = auth.jwt()->>'sub'
    ) AND
    EXISTS (
      SELECT 1 FROM public.tags t WHERE t.id = tag_id AND t.user_id = auth.jwt()->>'sub'
    )
  );
