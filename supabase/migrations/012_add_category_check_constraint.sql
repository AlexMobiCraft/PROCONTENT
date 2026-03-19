-- Migration: Add CHECK constraint for posts.category
-- Story: 2.1 Review Follow-up [AI-Review][CRITICAL]
-- Проблема: без ограничения в таблицу можно записать любую строку категории
-- и сломать клиентскую фильтрацию по категориям.
-- Допустимые значения соответствуют категориям в CategoryScroll (без 'all' — UI-only).

ALTER TABLE public.posts
  ADD CONSTRAINT posts_category_check
  CHECK (category IN ('insight', 'razobory', 'syomka', 'reels', 'brendy', 'tema'));
