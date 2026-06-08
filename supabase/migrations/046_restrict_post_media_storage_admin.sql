-- Migration 046: admin-only Storage INSERT/DELETE для bucket post_media
-- Story 8.1: код-ревью Finding 4 — broad-политики из 022 разрешали ЛЮБОМУ
-- authenticated пользователю создавать/удалять объекты bucket post_media
-- (включая thumbnails/). Ограничиваем INSERT/DELETE ролью admin (паттерн из 016/045).
-- Public SELECT (022) и admin UPDATE (045) остаются без изменений.
-- Идемпотентна: DROP IF EXISTS + CREATE.

-- ── INSERT: только admin ──────────────────────────────────────────────────────
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

-- ── DELETE: только admin ──────────────────────────────────────────────────────
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
