---
name: Supabase Migration
description: Навык для применения и управления миграциями базы данных с использованием Supabase CLI.
---

# Применение миграций с помощью Supabase CLI

Этот навык предназначен для процесса применения локальных SQL-миграций к удаленному (или локальному) проекту Supabase.

## Конфигурация проекта

**PROCONTENT использует self-hosted Supabase** на VPS (Hetzner), а НЕ Supabase Cloud.

- **API URL**: `http://178.105.163.252:8000` (= `https://api.procontent.si`)
- **Service Role Key**: из `.env.local` → `SUPABASE_SERVICE_ROLE_KEY`
- Supabase CLI (`npx supabase db push`) **не работает** с self-hosted инсталляцией — использовать API ниже.

## Применение миграции (PowerShell)

```powershell
$service = $env:SUPABASE_SERVICE_ROLE_KEY
$sql = (Get-Content "supabase/migrations/<файл>.sql" -Raw).ToString()
$body = '{"query": ' + ($sql | ConvertTo-Json) + '}'
$result = Invoke-RestMethod `
  -Uri "http://178.105.163.252:8000/pg/query" `
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
  -Uri "http://178.105.163.252:8000/pg/query" `
  -Method POST `
  -Headers @{ Authorization="Bearer $service"; apikey=$service; "Content-Type"="application/json" } `
  -Body $body | ConvertTo-Json -Depth 5
```

## Решение проблем

- **Пустой ответ от `/pg/query`**: нормально для DDL-команд (ALTER TABLE и т.п.) — означает успех.
- **`No API key found`**: передавайте ключ и в заголовке `Authorization: Bearer <key>`, и в `apikey: <key>`.
- **Supabase CLI не подключается**: self-hosted инсталляция не поддерживает `supabase link` / `db push` стандартным образом.
