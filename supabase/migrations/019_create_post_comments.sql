-- Migration: 019_create_post_comments.sql
-- Story 3.1: Таблица post_comments для просмотра обсуждений под постом

-- ── 1.1 Создать таблицу post_comments ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID        NOT NULL,
  user_id    UUID        NOT NULL,
  parent_id  UUID,                                   -- NULL = корневой комментарий, UUID = ответ
  content    TEXT        NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 1.2 Foreign keys ─────────────────────────────────────────────────────────
ALTER TABLE public.post_comments
  ADD CONSTRAINT post_comments_post_id_fkey
  FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;

ALTER TABLE public.post_comments
  ADD CONSTRAINT post_comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.post_comments
  ADD CONSTRAINT post_comments_parent_id_fkey
  FOREIGN KEY (parent_id) REFERENCES public.post_comments(id) ON DELETE CASCADE;

-- ── 1.3 Индексы для post_id и parent_id ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id
  ON public.post_comments(post_id);

CREATE INDEX IF NOT EXISTS idx_post_comments_parent_id
  ON public.post_comments(parent_id);

-- Составной индекс для загрузки корневых комментариев поста в хронологическом порядке
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id_created_at
  ON public.post_comments(post_id, created_at);

-- ── 1.4 RLS политики ──────────────────────────────────────────────────────────
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- SELECT: только активные подписчики (аналогично posts и post_media)
-- Переиспользуем is_active_subscriber() из 009_add_role_fix_admin_rls.sql
DROP POLICY IF EXISTS "post_comments_select_subscribers" ON public.post_comments;

CREATE POLICY "post_comments_select_subscribers"
  ON public.post_comments FOR SELECT
  TO authenticated
  USING (
    public.is_active_subscriber()
  );

-- INSERT: пользователь может добавлять комментарии от своего имени
DROP POLICY IF EXISTS "post_comments_insert_own" ON public.post_comments;

CREATE POLICY "post_comments_insert_own"
  ON public.post_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_active_subscriber()
  );

-- UPDATE: пользователь может редактировать только свои комментарии
DROP POLICY IF EXISTS "post_comments_update_own" ON public.post_comments;

CREATE POLICY "post_comments_update_own"
  ON public.post_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: пользователь может удалять свои комментарии; admin — любые
DROP POLICY IF EXISTS "post_comments_delete_own_or_admin" ON public.post_comments;

CREATE POLICY "post_comments_delete_own_or_admin"
  ON public.post_comments FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ── 1.5 Триггер updated_at ────────────────────────────────────────────────────
-- Переиспользуем функцию set_updated_at() из 011_add_updated_at_trigger.sql
DROP TRIGGER IF EXISTS trigger_post_comments_updated_at ON public.post_comments;

CREATE TRIGGER trigger_post_comments_updated_at
  BEFORE UPDATE ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
