-- Migration: 017_fix_post_media_review_followups.sql
-- Story 2.1: Исправление post_media на основе Review Follow-ups (AI)
-- Date: 2026-03-22

-- ── [MEDIUM] Расширить триггер: BEFORE INSERT OR UPDATE OF post_id ───────────────
-- Предыдущий триггер 016 был только BEFORE INSERT
-- Уязвимость: UPDATE post_id может обойти лимит 10 медиа
-- Исправление: добавить UPDATE OF post_id к триггеру

DROP TRIGGER IF EXISTS enforce_post_media_limit ON public.post_media;

CREATE TRIGGER enforce_post_media_limit
  BEFORE INSERT OR UPDATE OF post_id ON public.post_media
  FOR EACH ROW EXECUTE FUNCTION public.check_post_media_limit();

-- ── [HIGH] Исправить media_type для видео-постов, мигрированных как 'image' ─────
-- Review Find-up: В миграции 016 была ошибка: все посты мигрировались как 'image'
-- Даже видео-посты (type='video') стали image в post_media
-- Исправление: UPDATE для существующих видео-постов

UPDATE public.post_media pm
SET media_type = 'video'
FROM public.posts p
WHERE pm.post_id = p.id
  AND p.type = 'video'
  AND pm.media_type = 'image'
  AND pm.is_cover = true
  AND pm.order_index = 0;

-- Комментарий: Обновляем только cover-медиа (order_index=0, is_cover=true)
-- которые были мигрированы из image_url. Новые видео в post_media будут иметь
-- правильный media_type если используется обновленная SQL-логика.
