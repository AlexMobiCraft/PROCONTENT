-- Migration: Add updated_at trigger for posts table
-- Story: 2.1 Review follow-up — updated_at не обновлялась после INSERT

-- Функция обновления updated_at (переиспользуемая для любой таблицы)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Триггер на таблицу posts
CREATE TRIGGER trigger_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
