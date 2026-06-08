-- Migration 045: post_media video-thumbnail index + admin-only Storage UPDATE policy

CREATE INDEX IF NOT EXISTS idx_post_media_video_missing_thumbnail
  ON public.post_media (post_id)
  WHERE media_type = 'video' AND thumbnail_url IS NULL;

DROP POLICY IF EXISTS "authenticated_can_update_post_media" ON storage.objects;
DROP POLICY IF EXISTS "admin_can_update_post_media" ON storage.objects;

CREATE POLICY "admin_can_update_post_media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'post_media'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    bucket_id = 'post_media'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
