-- Migration: Create site_settings table (singleton)
-- Story: 4.3 Управление контентом для Onboarding и Лендинга

-- Singleton-таблица глобальных настроек сайта.
-- Содержит ровно одну строку (id = 1), вставляемую сразу.
CREATE TABLE public.site_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  whatsapp_url TEXT NOT NULL DEFAULT 'https://chat.whatsapp.com/placeholder',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Вставить единственную строку-дефолт
INSERT INTO public.site_settings (id, whatsapp_url) VALUES (1, 'https://chat.whatsapp.com/placeholder');

-- RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Анонимные и авторизованные пользователи могут читать настройки
CREATE POLICY "site_settings_select_all"
  ON public.site_settings FOR SELECT
  USING (true);

-- Только admin может обновлять настройки
CREATE POLICY "site_settings_update_admin"
  ON public.site_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Функция-триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION public.update_site_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_site_settings_updated_at();

-- RPC-функция для безопасного получения landing preview постов анонимными посетителями.
-- SECURITY DEFINER: выполняется с привилегиями владельца функции, обходя RLS на posts.
-- Возвращает только безопасный набор полей, не раскрывая контент платной базы знаний.
CREATE OR REPLACE FUNCTION public.get_landing_preview_posts()
RETURNS TABLE (
  id UUID,
  title TEXT,
  excerpt TEXT,
  category TEXT,
  created_at TIMESTAMPTZ,
  likes_count INTEGER,
  comments_count INTEGER
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    p.id,
    p.title,
    p.excerpt,
    p.category,
    p.created_at,
    p.likes_count,
    p.comments_count
  FROM public.posts p
  WHERE p.is_landing_preview = true
    AND p.is_published = true
  ORDER BY p.updated_at DESC, p.id DESC
  LIMIT 3;
$$;

-- Разрешить вызов функции анонимам
GRANT EXECUTE ON FUNCTION public.get_landing_preview_posts() TO anon;
GRANT EXECUTE ON FUNCTION public.get_landing_preview_posts() TO authenticated;

-- Функция-счётчик активных onboarding-постов (используется для guard на MAX=5)
CREATE OR REPLACE FUNCTION public.count_onboarding_posts(exclude_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.posts
  WHERE is_onboarding = true
    AND is_published = true
    AND (exclude_id IS NULL OR id != exclude_id);
$$;

GRANT EXECUTE ON FUNCTION public.count_onboarding_posts(UUID) TO authenticated;

-- Функция-счётчик активных landing preview постов (используется для guard на MAX=3)
CREATE OR REPLACE FUNCTION public.count_landing_preview_posts(exclude_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.posts
  WHERE is_landing_preview = true
    AND is_published = true
    AND (exclude_id IS NULL OR id != exclude_id);
$$;

GRANT EXECUTE ON FUNCTION public.count_landing_preview_posts(UUID) TO authenticated;
