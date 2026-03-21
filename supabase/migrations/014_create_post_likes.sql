-- Migration: Create post_likes table, toggle_like RPC, posts_is_liked computed column
-- Tech-Spec: post-likes-feature

-- ============================================================================
-- 1. Таблица post_likes с CASCADE
-- ============================================================================
CREATE TABLE public.post_likes (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- Индекс для быстрого поиска лайков конкретного пользователя
CREATE INDEX idx_post_likes_user_id ON public.post_likes(user_id);

-- ============================================================================
-- 2. Триггер для атомарного обновления likes_count в posts
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_post_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts
    SET likes_count = likes_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts
    SET likes_count = GREATEST(likes_count - 1, 0)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_post_likes_count
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_post_likes_count();

-- ============================================================================
-- 3. RPC toggle_like — возвращает json { is_liked, likes_count }
-- ============================================================================
CREATE OR REPLACE FUNCTION public.toggle_like(p_post_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_exists BOOLEAN;
  v_is_liked BOOLEAN;
  v_likes_count INT;
BEGIN
  -- Получаем user_id из JWT
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Проверяем существует ли лайк
  SELECT EXISTS(
    SELECT 1 FROM public.post_likes
    WHERE post_id = p_post_id AND user_id = v_user_id
  ) INTO v_exists;

  IF v_exists THEN
    -- Удаляем лайк
    DELETE FROM public.post_likes
    WHERE post_id = p_post_id AND user_id = v_user_id;
    v_is_liked := FALSE;
  ELSE
    -- Добавляем лайк
    INSERT INTO public.post_likes (post_id, user_id)
    VALUES (p_post_id, v_user_id);
    v_is_liked := TRUE;
  END IF;

  -- Читаем актуальный likes_count после триггера
  SELECT likes_count INTO v_likes_count
  FROM public.posts
  WHERE id = p_post_id;

  IF v_likes_count IS NULL THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  RETURN json_build_object(
    'is_liked', v_is_liked,
    'likes_count', v_likes_count
  );
END;
$$;

-- ============================================================================
-- 4. Computed Column: posts_is_liked (STABLE, invoker context)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.posts_is_liked(post_row public.posts)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.post_likes
    WHERE post_id = post_row.id
      AND user_id = auth.uid()
  );
$$;

-- ============================================================================
-- 5. RLS для post_likes
-- ============================================================================
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

-- Любой может читать лайки (для подсчётов)
CREATE POLICY "Anyone can read post_likes"
  ON public.post_likes FOR SELECT
  USING (true);

-- Пользователь может ставить лайки только от своего имени
CREATE POLICY "Users can insert own likes"
  ON public.post_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Пользователь может удалять только свои лайки
CREATE POLICY "Users can delete own likes"
  ON public.post_likes FOR DELETE
  USING (auth.uid() = user_id);
