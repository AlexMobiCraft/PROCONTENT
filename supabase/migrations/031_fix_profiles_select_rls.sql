-- Migration: 031_fix_profiles_select_rls.sql
-- Баг: обычные пользователи не видят авторов постов.
-- Причина: политика SELECT разрешала читать только свой профиль ИЛИ admin.
-- При join posts→profiles для чужих постов возвращался null.
-- Фикс: любой аутентифицированный пользователь может читать все профили
-- (display_name, avatar_url — публичные данные для отображения авторов).

DROP POLICY IF EXISTS "Users or admin can select profiles" ON public.profiles;

CREATE POLICY "Authenticated users can select profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
