DROP POLICY IF EXISTS "authenticated_can_upload_post_media" ON storage.objects;
DROP POLICY IF EXISTS "admin_can_upload_post_media" ON storage.objects;

CREATE POLICY "admin_can_upload_post_media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'post_media'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "authenticated_can_delete_post_media" ON storage.objects;
DROP POLICY IF EXISTS "admin_can_delete_post_media" ON storage.objects;

CREATE POLICY "admin_can_delete_post_media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'post_media'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
