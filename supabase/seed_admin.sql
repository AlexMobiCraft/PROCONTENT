-- seed_admin.sql
-- Назначение роли admin существующему пользователю для тестирования функционала модерации (Story 3.3)
--
-- Как использовать:
--   1. Убедитесь, что пользователь уже зарегистрирован в приложении (через форму Sign Up)
--   2. Замените 'your-email@example.com' на нужный email
--   3. Запустите в Supabase Dashboard → SQL Editor

UPDATE public.profiles
SET
  role                = 'admin',
  subscription_status = 'active',
  current_period_end  = now() + INTERVAL '1 year',
  display_name        = COALESCE(NULLIF(display_name, ''), 'Admin')
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'milenagasparin@gmail.com' LIMIT 1
);
