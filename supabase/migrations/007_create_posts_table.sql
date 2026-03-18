-- Migration: Create posts table
-- Story: 2.1 Базовая лента контента с бесконечным скроллом

CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT,
  category TEXT NOT NULL DEFAULT 'insight',
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'photo', 'video')),
  image_url TEXT,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  is_landing_preview BOOLEAN NOT NULL DEFAULT false,
  is_onboarding BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Индексы для пагинации и фильтрации
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX idx_posts_category ON public.posts(category);
CREATE INDEX idx_posts_published ON public.posts(is_published) WHERE is_published = true;

-- Row Level Security
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Чтение: авторизованные пользователи видят опубликованные посты
CREATE POLICY "Posts are viewable by authenticated users"
  ON public.posts FOR SELECT
  TO authenticated
  USING (is_published = true);

-- Полный доступ: только автор (admin)
CREATE POLICY "Admin can manage all posts"
  ON public.posts FOR ALL
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());
