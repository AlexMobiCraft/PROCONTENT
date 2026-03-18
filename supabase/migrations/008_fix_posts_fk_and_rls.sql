-- Migration: 008_fix_posts_fk_and_rls.sql
-- Fix 1 [CRITICAL]: Перепривязка FK posts.author_id → public.profiles(id)
--   Причина: Supabase автоматический join `profiles!author_id` требует FK в public.profiles.
--   Без этого запрос SELECT '*, profiles!author_id(...)' падает в runtime.
-- Fix 2 [CRITICAL]: RLS SELECT policy — добавить проверку активной подписки (AC #7)

-- ── Fix 1: пересоздать FK ─────────────────────────────────────────────────────
-- Удаляем FK на auth.users (создан в 007)
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_author_id_fkey;

-- Добавляем FK на public.profiles (нужен для Supabase join)
-- public.profiles.id уже ссылается на auth.users.id — целостность сохраняется
ALTER TABLE public.posts
  ADD CONSTRAINT posts_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ── Fix 2: обновить RLS SELECT policy ─────────────────────────────────────────
DROP POLICY IF EXISTS "Posts are viewable by authenticated users" ON public.posts;

-- Только пользователи с активной подпиской видят опубликованные посты (AC #7)
CREATE POLICY "Posts are viewable by subscribers"
  ON public.posts FOR SELECT
  TO authenticated
  USING (
    is_published = true
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.subscription_status IN ('active', 'trialing')
    )
  );
