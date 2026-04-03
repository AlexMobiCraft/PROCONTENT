-- Migration 038: pg_cron задача для автоматической публикации запланированных постов
-- Story 6.2: pg_cron — Автоматическая публикация запланированных постов
--
-- Предварительные требования:
--   1. Расширение pg_net должно быть включено (Settings → Extensions → pg_net)
--   2. Расширение pg_cron должно быть включено (Settings → Extensions → pg_cron)
--   3. Переменная CRON_SECRET должна быть задана в Vercel Environment Variables
--   4. Приложение должно быть задеплоено по адресу NEXT_PUBLIC_SITE_URL
--
-- ⚠️  ТРЕБУЕТСЯ: замените YOUR_APP_URL и YOUR_CRON_SECRET на реальные значения
--    перед применением миграции через `supabase db push`.
--    При наличии placeholder-значений миграция завершится с ошибкой.
--
-- После применения миграции проверить:
--   SELECT * FROM cron.job WHERE jobname = 'publish-scheduled-posts';
--
-- Для удаления задачи (при необходимости):
--   SELECT cron.unschedule('publish-scheduled-posts');

DO $$
DECLARE
  -- Замените YOUR_APP_URL на NEXT_PUBLIC_SITE_URL (напр. https://procontent-ten.vercel.app)
  v_url    text := 'YOUR_APP_URL';
  -- Замените YOUR_CRON_SECRET на значение CRON_SECRET из окружения
  v_secret text := 'YOUR_CRON_SECRET';
BEGIN
  -- Guard: миграция завершается с ошибкой если placeholder-значения не заменены
  IF v_url = 'YOUR_APP_URL' THEN
    RAISE EXCEPTION
      'Migration 038: Replace YOUR_APP_URL with actual app URL (NEXT_PUBLIC_SITE_URL) before applying this migration';
  END IF;
  IF v_secret = 'YOUR_CRON_SECRET' THEN
    RAISE EXCEPTION
      'Migration 038: Replace YOUR_CRON_SECRET with actual CRON_SECRET value before applying this migration';
  END IF;

  PERFORM cron.schedule(
    'publish-scheduled-posts',
    '*/5 * * * *',
    'SELECT net.http_post('
      || 'url := ' || quote_literal(v_url || '/api/cron/publish') || ', '
      || 'headers := ' || quote_literal('{"Authorization": "Bearer ' || v_secret || '", "Content-Type": "application/json"}') || '::jsonb, '
      || 'body := ' || quote_literal('{}') || '::jsonb'
    || ')'
  );
END;
$$;
