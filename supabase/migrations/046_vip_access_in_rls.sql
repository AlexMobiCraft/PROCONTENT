-- 046_vip_access_in_rls.sql
-- Паритет доступа VIP в RLS. Миграция 045 ввела is_vip как источник доступа в
-- middleware, но is_active_subscriber() (миграции 009/010) учитывает только
-- subscription_status. Без этой правки VIP проходит middleware, но RLS на
-- posts/post_media/post_comments возвращает пусто (фактически нет доступа к контенту).

-- Доступ к контенту = VIP ИЛИ активная/триальная подписка. SET search_path сохранён (см. 010).
CREATE OR REPLACE FUNCTION public.is_active_subscriber()
  RETURNS BOOLEAN
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (is_vip = true OR subscription_status IN ('active', 'trialing'))
  );
$$;
