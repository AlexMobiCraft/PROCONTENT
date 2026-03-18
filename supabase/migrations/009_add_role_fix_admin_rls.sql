-- Migration: 009_add_role_fix_admin_rls.sql
-- Fix 1 [HIGH]: Добавить колонку role в profiles, ограничить admin-политику по роли
-- Fix 2 [MEDIUM]: Оптимизировать RLS-проверку подписки через SECURITY DEFINER функцию

-- ── Fix 1: Добавить role в profiles ──────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member'
  CHECK (role IN ('member', 'admin'));

-- Индекс для быстрого lookup admin-ов в RLS
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role) WHERE role = 'admin';

-- Удаляем старую политику, которая позволяла любому authenticated управлять своими постами
DROP POLICY IF EXISTS "Admin can manage all posts" ON public.posts;

-- Новая политика: только пользователи с role='admin' могут INSERT/UPDATE/DELETE
CREATE POLICY "Admin can manage posts"
  ON public.posts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ── Fix 2: Оптимизация RLS подзапроса подписки ──────────────────────────────
-- SECURITY DEFINER функция кешируется per-statement, избегая повторных подзапросов
CREATE OR REPLACE FUNCTION public.is_active_subscriber()
  RETURNS BOOLEAN
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND subscription_status IN ('active', 'trialing')
  );
$$;

-- Обновляем SELECT политику, используя функцию вместо inline подзапроса
DROP POLICY IF EXISTS "Posts are viewable by subscribers" ON public.posts;

CREATE POLICY "Posts are viewable by subscribers"
  ON public.posts FOR SELECT
  TO authenticated
  USING (
    is_published = true
    AND public.is_active_subscriber()
  );
