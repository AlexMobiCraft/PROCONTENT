-- Migration: Обновление категорий постов
-- Новая система категорий для правой панели тем + верхнее меню.
-- Верхнее меню: 'tema', 'zacetek' (+ 'all' — UI-only, не хранится в БД)
-- Темы правой панели: 'stories', 'estetski-kadri', 'snemanje', 'izrezi',
--                     'komercialni', 'ugc', 'objavljanje', 'drugo'

-- 1. Снимаем старый CHECK constraint
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_category_check;

-- 2. Маппинг старых категорий → новые
UPDATE public.posts SET category = 'stories'     WHERE category = 'insight';
UPDATE public.posts SET category = 'stories'     WHERE category = 'razobory';
UPDATE public.posts SET category = 'snemanje'    WHERE category = 'syomka';
UPDATE public.posts SET category = 'objavljanje' WHERE category = 'reels';
UPDATE public.posts SET category = 'komercialni' WHERE category = 'brendy';
-- 'tema' → остаётся без изменений

-- 3. Новый CHECK constraint с актуальными значениями
ALTER TABLE public.posts
  ADD CONSTRAINT posts_category_check
  CHECK (category IN (
    'tema',
    'zacetek',
    'stories',
    'estetski-kadri',
    'snemanje',
    'izrezi',
    'komercialni',
    'ugc',
    'objavljanje',
    'drugo'
  ));
