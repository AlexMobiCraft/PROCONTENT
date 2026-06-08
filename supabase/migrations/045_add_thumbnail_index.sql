-- Migration 045: Индекс для видео без thumbnail + Storage UPDATE политика
-- Story 8.1: Avtomatsko generiranje thumbnaila ob shranjevanju objave
-- Идемпотентна: IF NOT EXISTS для индекса, DROP/CREATE для политики.
--
-- ПРИМЕЧАНИЕ: номер 045 (а не 031 из черновика story) — 031 уже занят
-- (031_fix_profiles_select_rls.sql), последняя миграция была 044.

-- ── 1. Частичный индекс: быстрый поиск видео-записей без thumbnail ─────────────
-- Применяется для ретроактивной генерации (Story 8.3) и проверок состояния.
CREATE INDEX IF NOT EXISTS idx_post_media_video_missing_thumbnail
  ON public.post_media (post_id)
  WHERE media_type = 'video' AND thumbnail_url IS NULL;

-- ── 2. Storage RLS: разрешить authenticated UPDATE в bucket post_media ─────────
-- Нужно для upsert (перезапись) thumbnail'ов по пути thumbnails/{post_media_id}_thumb.jpg.
-- INSERT и public SELECT уже созданы в 022_create_post_media_bucket.sql и покрывают
-- подпапку thumbnails/. Запись в таблицу post_media.thumbnail_url дополнительно
-- ограничена admin-only RLS (016_create_post_media.sql), поэтому фактический путь
-- записи thumbnail закрыт ролью admin на уровне БД.
DROP POLICY IF EXISTS "authenticated_can_update_post_media" ON storage.objects;

CREATE POLICY "authenticated_can_update_post_media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'post_media')
  WITH CHECK (bucket_id = 'post_media');
