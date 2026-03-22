-- Migration: 016_create_post_media.sql
-- Story 2.1: Нормализованная модель данных для мультимедиа (post_media table)
-- Идемпотентна: повторный запуск не вызывает ошибок (IF NOT EXISTS, ON CONFLICT DO NOTHING)

-- ── 1.1 Создать таблицу post_media ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_media (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID    NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  media_type    TEXT    NOT NULL CHECK (media_type IN ('image', 'video')),
  url           TEXT    NOT NULL,
  thumbnail_url TEXT,                           -- nullable, только для видео
  order_index   INTEGER NOT NULL DEFAULT 0,
  is_cover      BOOLEAN NOT NULL DEFAULT false,

  -- UNIQUE(post_id, order_index) обеспечивает ON CONFLICT DO NOTHING при миграции данных
  -- и запрещает дублирующие позиции для одного поста
  CONSTRAINT uq_post_media_post_order UNIQUE (post_id, order_index)
);

-- ── 1.2 Индексы для JOIN-запросов ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_post_media_post_id
  ON public.post_media(post_id);

CREATE INDEX IF NOT EXISTS idx_post_media_post_id_order
  ON public.post_media(post_id, order_index);

-- ── 1.3 Включить RLS ─────────────────────────────────────────────────────────
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;

-- ── 1.4 SELECT: только активные подписчики ───────────────────────────────────
-- Переиспользуем is_active_subscriber() из 009_add_role_fix_admin_rls.sql
-- НЕ пересоздаём функцию — она уже существует как SECURITY DEFINER STABLE
DROP POLICY IF EXISTS "post_media_select_subscribers" ON public.post_media;

CREATE POLICY "post_media_select_subscribers"
  ON public.post_media FOR SELECT
  TO authenticated
  USING (
    public.is_active_subscriber()
  );

-- ── 1.5 INSERT/UPDATE/DELETE: только admin ────────────────────────────────────
-- Паттерн идентичен 009_add_role_fix_admin_rls.sql
DROP POLICY IF EXISTS "post_media_admin_all" ON public.post_media;

CREATE POLICY "post_media_admin_all"
  ON public.post_media FOR ALL
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

-- ── 1.6 Триггер: максимум 10 медиафайлов на пост ─────────────────────────────
-- PostgreSQL не поддерживает subquery в CHECK-ограничениях → триггер BEFORE INSERT
CREATE OR REPLACE FUNCTION public.check_post_media_limit()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.post_media WHERE post_id = NEW.post_id) >= 10 THEN
    RAISE EXCEPTION 'Превышен лимит медиафайлов для поста (максимум 10)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_post_media_limit ON public.post_media;

CREATE TRIGGER enforce_post_media_limit
  BEFORE INSERT ON public.post_media
  FOR EACH ROW EXECUTE FUNCTION public.check_post_media_limit();

-- ── 1.7 Миграция данных: image_url → post_media ──────────────────────────────
-- Все posts.image_url IS NOT NULL → post_media (is_cover=true, order_index=0)
-- Идемпотентно: ON CONFLICT ON CONSTRAINT uq_post_media_post_order DO NOTHING
INSERT INTO public.post_media (post_id, media_type, url, order_index, is_cover)
SELECT
  id        AS post_id,
  'image'   AS media_type,
  image_url AS url,
  0         AS order_index,
  true      AS is_cover
FROM public.posts
WHERE image_url IS NOT NULL
ON CONFLICT ON CONSTRAINT uq_post_media_post_order DO NOTHING;

-- ── 1.8 Расширить CHECK-ограничение type в posts ──────────────────────────────
-- Добавляем 'gallery' (для галерей из post_media) и 'multi-video'
-- Текущее ограничение из 007: CHECK (type IN ('text', 'photo', 'video'))
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_type_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_type_check
  CHECK (type IN ('text', 'photo', 'video', 'gallery', 'multi-video'));
