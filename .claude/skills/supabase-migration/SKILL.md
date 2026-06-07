---
name: Supabase Migration
description: Навык для применения и управления миграциями базы данных с использованием Supabase CLI.
---

# Применение миграций с помощью Supabase CLI

Этот навык предназначен для процесса применения локальных SQL-миграций к удаленному (или локальному) проекту Supabase.

## Конфигурация проекта

**PROCONTENT использует self-hosted Supabase** на VPS (Hetzner), а НЕ Supabase Cloud.

- **API URL**: `https://api.procontent.si`
- **Service Role Key**: из `.env.local` → `SUPABASE_SERVICE_ROLE_KEY`
- Supabase CLI (`npx supabase db push`) **не работает** с self-hosted инсталляцией — использовать API ниже.

## Применение миграции (PowerShell)

```powershell
$service = $env:SUPABASE_SERVICE_ROLE_KEY
$sql = (Get-Content "supabase/migrations/<файл>.sql" -Raw).ToString()
$body = '{"query": ' + ($sql | ConvertTo-Json) + '}'
$result = Invoke-RestMethod `
  -Uri "https://api.procontent.si/pg/query" `
  -Method POST `
  -Headers @{ Authorization="Bearer $service"; apikey=$service; "Content-Type"="application/json" } `
  -Body $body
$result | ConvertTo-Json -Depth 5
```

## Проверка результата

```powershell
$service = $env:SUPABASE_SERVICE_ROLE_KEY
$checkSql = "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'posts';"
$body = '{"query": ' + ($checkSql | ConvertTo-Json) + '}'
Invoke-RestMethod `
  -Uri "https://api.procontent.si/pg/query" `
  -Method POST `
  -Headers @{ Authorization="Bearer $service"; apikey=$service; "Content-Type"="application/json" } `
  -Body $body | ConvertTo-Json -Depth 5
```

## Решение проблем

### Ошибка DNS: `ENOTFOUND db.[PROJECT_ID].supabase.co`
Это происходит в сетях, где не поддерживается IPv6 (прямой адрес Supabase работает только через IPv6). 
- **Решение**: Используйте **Connection Pooler Host** (найдите его в Dashboard -> Settings -> Database). Обычно это `aws-1-eu-north-1.pooler.supabase.com` и порт **6543**.

### Ошибка: `password authentication failed for user "postgres"`
1. **URI Encoding**: Если вы используете строку подключения (connectionString), закодируйте пароль через `encodeURIComponent(pass)`. Символ `+` превращается в `%2B`, без этого авторизация НЕ пройдет.
2. **Username**: В режиме пуллера (порт 6543) имя пользователя **обязательно** должно включать проект-референс: `postgres.[YOUR_PROJECT_ID]`.

### Кастомный скрипт: `supabase/apply-migrations.js`
Если стандартный CLI выдает ошибки, используйте этот скрипт. Он:
- Работает через IPv4/Пулер (порт 6543).
- Автоматически считывает конфиг и пароли из `.env.local`.
- Умеет игнорировать ошибки "already exists", если вы частично накатывали схему вручную.
- **ВАЖНО**: Сидирование (`seed_posts.sql`) запускается **ТОЛЬКО** при наличии флага `--seed`. По умолчанию оно пропущено.
  ```bash
  node supabase/apply-migrations.js --seed
  ```
