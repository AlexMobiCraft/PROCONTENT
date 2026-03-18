-- Migration: 010_fix_security_definer_and_perf_index.sql
-- Fix 1 [MEDIUM]: SECURITY DEFINER функция is_active_subscriber() без SET search_path
--   Уязвимость: атакующий может создать схему с приоритетом выше public и подменить
--   таблицы/функции, вызываемые внутри SECURITY DEFINER контекста.
-- Fix 2 [LOW]: Отсутствует составной индекс (created_at DESC, id DESC) WHERE is_published = true
--   Без него cursor-based пагинация с tiebreaker по id требует полного сканирования индекса.

-- ── Fix 1: Добавляем SET search_path = public ────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_active_subscriber()
  RETURNS BOOLEAN
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND subscription_status IN ('active', 'trialing')
  );
$$;

-- ── Fix 2: Составной индекс для cursor-based пагинации ───────────────────────
-- Покрывает запросы вида: ORDER BY created_at DESC, id DESC WHERE is_published = true
-- Курсор использует оба поля: `created_at.lt.X OR (created_at.eq.X AND id.lt.Y)`
CREATE INDEX IF NOT EXISTS idx_posts_cursor
  ON public.posts(created_at DESC, id DESC)
  WHERE is_published = true;
