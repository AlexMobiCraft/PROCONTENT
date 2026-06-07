-- Migration 043: Сделать категорию (тему) поста необязательной
-- Требование: при создании поста тему указывать не обязательно,
-- а при удалении темы — она должна сниматься со всех постов, которые её используют.

-- 1. Категория больше не обязательна и не имеет значения по умолчанию
ALTER TABLE public.posts ALTER COLUMN category DROP NOT NULL;
ALTER TABLE public.posts ALTER COLUMN category DROP DEFAULT;

-- 2. Пересоздаём внешний ключ: при удалении категории её slug
--    автоматически обнуляется (SET NULL) у всех связанных постов.
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_category_fkey;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_category_fkey
  FOREIGN KEY (category) REFERENCES public.categories(slug)
  ON UPDATE RESTRICT ON DELETE SET NULL;
