---
title: 'План: запуск scheduled-публикации на проде (корень B миграции рассылки)'
type: 'infra-runbook'
created: '2026-06-11'
related_spec: 'spec-fix-new-post-email-delivery.md'
status: 'ready'
---

# План: запуск scheduled-публикации на проде (корень B)

Инфраструктурная часть фикса рассылки о новых постах (см. [spec-fix-new-post-email-delivery.md](./spec-fix-new-post-email-delivery.md), корень B). Код корня A уже реализован и смёржен в working tree; этот runbook закрывает scheduled-ветку и AC2.

## Контекст инфраструктуры

- **Боевая БД:** self-hosted Supabase, Hetzner VPS `178.105.163.252`
- **Доступ (2 способа):**
  - **SSH (надёжно, рекомендуется):** `ssh root@178.105.163.252 "docker exec -i supabase-db psql -U postgres -d postgres"`
  - Supavisor-pooler `5432` (session, DDL), user `postgres.default` — только если порт открыт в firewall Hetzner
- **Известно из диагностики (11 июня 2026):** `pg_cron` в `shared_preload_libraries` есть, но `CREATE EXTENSION` не выполнен; `cron.database_name=postgres`
- **Секрет НЕ коммитим:** файл `supabase/migrations/038_pg_cron_publish_scheduled_posts.sql` остаётся с placeholder'ами `YOUR_APP_URL`/`YOUR_CRON_SECRET`. Реальные значения подставляем только в рантайме через stdin/env.

---

## Фаза 0 — Подготовка и проверки (read-only)

1. **Достать актуальный `CRON_SECRET`** из Vercel (Settings → Environment Variables, Production). Записать локально на время работы — он должен совпадать с тем, что попадёт в cron-задачу.
2. **Проверить наличие `pg_net`** (миграция использует `net.http_post`):
   ```sql
   SELECT extname, extversion FROM pg_extension WHERE extname IN ('pg_net','pg_cron');
   ```
   - Ожидание: `pg_net` присутствует, `pg_cron` — **отсутствует** (это и чиним).
   - Если `pg_net` нет → сначала `CREATE EXTENSION IF NOT EXISTS pg_net;`.
3. **Подтвердить конфиг pg_cron:**
   ```sql
   SHOW shared_preload_libraries;          -- должна быть pg_cron
   SHOW cron.database_name;                 -- должно быть postgres
   ```
4. **Зафиксировать «висящий» scheduled-пост** для последующей проверки AC2:
   ```sql
   SELECT id, title, status, scheduled_at FROM posts
   WHERE status='scheduled' AND scheduled_at <= now() ORDER BY scheduled_at;
   ```

---

## Фаза 1 — `CREATE EXTENSION pg_cron`

> Выполнять под суперюзером (`postgres`), в БД `postgres` (совпадает с `cron.database_name`).

```bash
ssh root@178.105.163.252 "docker exec -i supabase-db psql -U postgres -d postgres" <<'SQL'
CREATE EXTENSION IF NOT EXISTS pg_cron;
SQL
```

**Проверка:**
```sql
SELECT * FROM pg_extension WHERE extname='pg_cron';   -- строка появилась
SELECT * FROM cron.job;                                -- таблица существует (пустая)
```

> Если `CREATE EXTENSION` падает с `pg_cron must be loaded via shared_preload_libraries` — библиотека не подхвачена; нужен рестарт контейнера БД (`docker compose restart db`) после правки `shared_preload_libraries`, затем повтор.

---

## Фаза 2 — Применить миграцию `038` с www-URL и реальным секретом

> ⚠️ **Канонический `https://www.procontent.si`** (НЕ апекс — иначе апекс→www-редирект режет `Authorization`). Секрет подставляем в рантайме, в репозиторий не пишем.

Ad-hoc запуск тела миграции с подставленными значениями (секрет через env контейнера, без записи в файл):

```bash
# CRON_SECRET берём из Vercel (Фаза 0). Передаём через env, без сохранения в файл.
ssh root@178.105.163.252 "CRON_SECRET='<секрет_из_Vercel>' docker exec -i -e CRON_SECRET supabase-db \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1" <<'SQL'
DO $$
DECLARE
  v_url    text := 'https://www.procontent.si';
  v_secret text := current_setting('CRON_SECRET', true);  -- из env контейнера
BEGIN
  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE EXCEPTION 'CRON_SECRET is empty';
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
SQL
```

> Примечание: `current_setting('CRON_SECRET')` сработает только если env проброшен как GUC. Если на этой сборке Postgres так не выходит — передать `psql -v secret="$CRON_SECRET"` и в SQL использовать `:'secret'`. Главное — **не сохранять секрет в файл репозитория**. `cron.schedule` идемпотентен по `jobname` (повторный запуск перезапишет задачу).

**Проверка (критично — URL=www, секрет совпадает):**
```sql
SELECT jobid, schedule, command FROM cron.job WHERE jobname='publish-scheduled-posts';
```
- В `command` должен быть `https://www.procontent.si/api/cron/publish` и `Bearer <тот же CRON_SECRET, что в Vercel>`.

---

## Фаза 3 — Ручная проверка AC2 (scheduled → published → Resend)

> AC2 не закрывается unit-тестами — только живой прогон на проде.

1. **Дождаться тика (≤5 мин) или вызвать вручную:**
   ```sql
   SELECT net.http_post(
     url := 'https://www.procontent.si/api/cron/publish',
     headers := '{"Authorization":"Bearer <секрет>","Content-Type":"application/json"}'::jsonb,
     body := '{}'::jsonb
   );
   ```
2. **Проверить выполнение cron-задачи:**
   ```sql
   SELECT jobid, status, return_message, start_time
   FROM cron.job_run_details
   WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname='publish-scheduled-posts')
   ORDER BY start_time DESC LIMIT 5;
   ```
3. **Проверить HTTP-ответ pg_net (egress до www + статус 200):**
   ```sql
   SELECT id, status_code, content_type, created
   FROM net._http_response ORDER BY created DESC LIMIT 5;
   ```
   - Ожидание: `status_code = 200`. `status_code IS NULL` → egress из DB-контейнера до `www.procontent.si` заблокирован (проверить firewall/DNS на VPS).
4. **Проверить переход поста:**
   ```sql
   SELECT id, status, published_at FROM posts WHERE id = '<id_висевшего_поста>';
   ```
   - Ожидание: `status='published'`, `published_at` заполнен.
5. **Resend Dashboard:** появилась попытка отправки письма (`Nova objava: …`). В логах приложения (Vercel) — `[notifications] Sent N/M`, НЕ `Email failed`.

---

## Откат / устранение неполадок

- **Снять задачу:** `SELECT cron.unschedule('publish-scheduled-posts');`
- **`status_code` пустой** → egress заблокирован: проверить, что DB-контейнер ходит наружу:
  `docker exec supabase-db curl -sS -o /dev/null -w '%{http_code}' https://www.procontent.si/api/cron/publish`
- **401 в `net._http_response`** → `CRON_SECRET` в cron-задаче ≠ Vercel: пересоздать задачу (Фаза 2) с верным секретом.
- **307 в ответе** → URL апекс, а не www: пересоздать задачу с `https://www.procontent.si`.

---

## Рекомендация (вне scope, опционально)

Vercel: `NEXT_PUBLIC_SITE_URL=https://www.procontent.si` — убирает апекс→www-редиректы в ссылках писем (`postUrl`, `unsubscribeUrl`). Фикс A делает доставку независимой от этого, но каноничный www чище.

---

## Definition of Done (корень B)

- [ ] Фаза 0: `CRON_SECRET` сверен с Vercel; `pg_net` присутствует; `cron.database_name=postgres`
- [ ] Фаза 1: `pg_extension` содержит `pg_cron`; схема `cron` доступна
- [ ] Фаза 2: `cron.job` содержит `publish-scheduled-posts` с www-URL и верным Bearer
- [ ] Фаза 3: `cron.job_run_details.status='succeeded'`, `net._http_response.status_code=200`, висевший пост → `published`, в Resend — попытка отправки
