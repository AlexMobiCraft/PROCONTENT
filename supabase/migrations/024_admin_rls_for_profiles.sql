-- Migration: 024_admin_rls_for_profiles.sql
-- Story 4.4: Мониторинг участниц — RLS admin для profiles
-- Добавляет SECURITY DEFINER функцию is_admin() и расширяет политики SELECT/UPDATE

-- SECURITY DEFINER нужен чтобы избежать рекурсии: политика на profiles не может делать
-- прямой subquery на profiles без SECURITY DEFINER функции-обёртки.
-- Этот же паттерн уже используется в is_active_subscriber() (миграция 009).
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS BOOLEAN
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

-- Заменить существующую SELECT-политику: пользователь видит свой профиль ИЛИ admin видит все
DROP POLICY IF EXISTS "Пользователи видят только свой профиль" ON public.profiles;
CREATE POLICY "Users or admin can select profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_admin());

-- Заменить UPDATE-политику: пользователь обновляет свой профиль ИЛИ admin обновляет любой
DROP POLICY IF EXISTS "Пользователи обновляют только свой профиль" ON public.profiles;
CREATE POLICY "Users or admin can update profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());
