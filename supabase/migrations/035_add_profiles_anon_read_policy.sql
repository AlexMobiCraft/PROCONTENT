-- Migration: Allow anonymous users to read profiles (author data)
-- Story: 5.1 Telegram Migration

DROP POLICY IF EXISTS "profiles_select_anon" ON public.profiles;

CREATE POLICY "profiles_select_anon"
  ON public.profiles FOR SELECT
  TO anon
  USING (true);
