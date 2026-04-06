-- Migration: 041_sync_existing_comments_count.sql
-- Баг: существующие комментарии не учитывались в posts.comments_count,
-- потому что триггер (040) работает только для новых INSERT/DELETE.
-- Синхронизируем счётчик с фактическим количеством комментариев.

UPDATE public.posts p
SET comments_count = (
  SELECT COUNT(*)::int
  FROM public.post_comments pc
  WHERE pc.post_id = p.id
);
