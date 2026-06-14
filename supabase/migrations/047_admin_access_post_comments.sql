-- 047_admin_access_post_comments.sql
-- Паритет доступа admin к комментариям.
--
-- Баг: пост открывается, но комментарии не отображаются для admin-аккаунта без
-- активной подписки/VIP. Причина — асимметрия RLS:
--   * posts       — admin видит через "Admin can manage posts" (FOR ALL, role=admin, мигр. 009)
--   * post_media  — admin видит через FOR ALL (role=admin, мигр. 016)
--   * post_comments — SELECT только public.is_active_subscriber() (мигр. 019),
--                     а is_active_subscriber() (мигр. 046) НЕ учитывает role='admin'.
-- Итог: админ читает пост и медиа, но post_comments возвращает 0 строк.
--
-- Фикс: даём admin доступ к SELECT (просмотр) и INSERT (ответы) — паритет с
-- DELETE-политикой "post_comments_delete_own_or_admin", которая admin уже учитывает.

-- SELECT: активные подписчики/VIP ИЛИ admin
DROP POLICY IF EXISTS "post_comments_select_subscribers" ON public.post_comments;

CREATE POLICY "post_comments_select_subscribers"
  ON public.post_comments FOR SELECT
  TO authenticated
  USING (
    public.is_active_subscriber()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- INSERT: комментарий от своего имени; доступ = активная подписка/VIP ИЛИ admin
DROP POLICY IF EXISTS "post_comments_insert_own" ON public.post_comments;

CREATE POLICY "post_comments_insert_own"
  ON public.post_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.is_active_subscriber()
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
      )
    )
  );
