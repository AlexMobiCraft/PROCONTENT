-- Migration: Add CHECK constraints for non-negative counters in posts table
-- Story: 2.1 — предотвращает запись отрицательных значений likes_count и comments_count

ALTER TABLE public.posts
  ADD CONSTRAINT check_likes_count_non_negative CHECK (likes_count >= 0),
  ADD CONSTRAINT check_comments_count_non_negative CHECK (comments_count >= 0);
