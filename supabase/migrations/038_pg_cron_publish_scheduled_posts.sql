-- Migration 038: pg_cron задача для автоматической публикации запланированных постов
-- Story 6.2: pg_cron — Автоматическая публикация запланированных постов
--
-- Предварительные требования:
--   1. Расширение pg_net должно быть включено (Settings → Extensions → pg_net)
--   2. Расширение pg_cron должно быть включено (Settings → Extensions → pg_cron)
--   3. Переменная CRON_SECRET должна быть задана в Vercel Environment Variables
--   4. Приложение должно быть задеплоено по адресу NEXT_PUBLIC_SITE_URL
--
-- После применения миграции проверить:
--   SELECT * FROM cron.job WHERE jobname = 'publish-scheduled-posts';
--
-- Для удаления задачи (при необходимости):
--   SELECT cron.unschedule('publish-scheduled-posts');

-- Создать cron-задачу, вызывающую cron endpoint каждые 5 минут.
-- Замените YOUR_APP_URL и YOUR_CRON_SECRET на реальные значения из окружения.
-- Для production: YOUR_APP_URL = NEXT_PUBLIC_SITE_URL, YOUR_CRON_SECRET = CRON_SECRET
SELECT cron.schedule(
  'publish-scheduled-posts',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_APP_URL/api/cron/publish',
    headers := '{"Authorization": "Bearer YOUR_CRON_SECRET", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);
