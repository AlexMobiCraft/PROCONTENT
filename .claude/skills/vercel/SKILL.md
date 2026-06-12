---
name: vercel
description: Deploy and manage Vercel projects. Use when the user wants to deploy to Vercel, manage environment variables, configure vercel.json, work with domains, view logs, rollback deployments, or manage Vercel Functions via CLI.
tools: Bash, Read, Write, Edit, WebFetch
---

# Vercel — управление проектами

Навык охватывает полный цикл работы с Vercel: деплой, конфигурация, переменные окружения, домены, функции, логи.

## Установка и аутентификация

```bash
# Установка CLI
npm i -g vercel

# Логин (интерактивный)
vercel login
vercel login --github

# Проверка текущего пользователя
vercel whoami

# Привязать локальную директорию к проекту
vercel link
```

**В CI/CD** используй `VERCEL_TOKEN` как переменную окружения — безопаснее, чем флаг `--token`.

---

## Деплой

### Базовые команды

```bash
vercel                    # Preview деплой (интерактивный)
vercel deploy             # Preview деплой
vercel deploy --prod      # Production деплой
vercel --prod             # Краткая форма production деплоя

vercel build              # Локальная сборка (без деплоя)
vercel build --prod       # Сборка с production окружением

vercel redeploy [url]     # Пересобрать и задеплоить существующий деплой
vercel rollback           # Откат на предыдущий production деплой
vercel rollback [url]     # Откат на конкретный деплой
```

### Просмотр деплоев

```bash
vercel list               # Список последних деплоев текущего проекта
vercel list [project]     # Деплои конкретного проекта
vercel inspect [url]      # Детальная информация о деплое
vercel inspect [url] --logs  # С логами
vercel open               # Открыть дашборд проекта в браузере
```

### Promote и Rolling Release

```bash
vercel promote [url]      # Сделать деплой текущим production
vercel rolling-release start --dpl=[deployment-id]   # Начать постепенный роллаут
vercel rolling-release approve --dpl=[deployment-id] # Одобрить следующий шаг
vercel rolling-release complete --dpl=[deployment-id] # Завершить роллаут
```

---

## Переменные окружения

### CLI-управление

```bash
vercel env ls                          # Список всех переменных
vercel env add NAME                    # Добавить (интерактивно)
vercel env add NAME production         # Добавить для production
vercel env add NAME preview            # Добавить для preview
vercel env add NAME development        # Добавить для development
vercel env update NAME                 # Обновить значение
vercel env rm NAME                     # Удалить из всех окружений
vercel env rm NAME production          # Удалить только из production

# Скачать dev-переменные в .env файл
vercel env pull
vercel env pull .env.local             # В конкретный файл
vercel env pull --environment=production

# Запустить команду с подставленными переменными
vercel env run -- npm test
```

### Окружения (environments)

| Окружение | Когда применяется |
|-----------|-------------------|
| `production` | Push в main ветку или `vercel --prod` |
| `preview` | Push в любую другую ветку или `vercel` |
| `development` | Локальная разработка (`vercel dev`) или `vercel env pull` |

**Важно:** Изменения переменных применяются только к **новым** деплоям.

### Системные переменные (автоматические)

| Переменная | Значение |
|------------|---------|
| `VERCEL` | `"1"` |
| `VERCEL_ENV` | `"production"` / `"preview"` / `"development"` |
| `VERCEL_URL` | URL текущего деплоя (без `https://`) |
| `VERCEL_BRANCH_URL` | URL ветки |
| `VERCEL_GIT_COMMIT_SHA` | SHA коммита |
| `VERCEL_GIT_COMMIT_REF` | Имя ветки |
| `VERCEL_GIT_REPO_SLUG` | Имя репозитория |
| `VERCEL_REGION` | Регион выполнения функции |

Для клиентского кода добавь префикс `NEXT_PUBLIC_` (Next.js) или `VITE_` (Vite).

---

## Конфигурация vercel.json

Создай в корне проекта. Всегда добавляй `$schema` для автодополнения в IDE:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json"
}
```

### Сборка

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "outputDirectory": ".next",
  "devCommand": "npm run dev",
  "ignoreCommand": "git diff --quiet HEAD^ HEAD ./"
}
```

`ignoreCommand`: если exit code = 0 → сборка пропускается; exit code = 1 → сборка запускается.

### Функции (Vercel Functions)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "functions": {
    "api/heavy.js": {
      "maxDuration": 60,
      "memory": 3009
    },
    "api/edge-fn.js": {
      "runtime": "edge"
    },
    "api/**/*.py": {
      "runtime": "vercel-python@4.x"
    }
  }
}
```

Лимиты `maxDuration`: Hobby — 60s, Pro — 300s, Enterprise — 900s.

### Регионы

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["iad1"],
  "functionFailoverRegions": ["sfo1"],
  "functions": {
    "api/eu.js": {
      "regions": ["cdg1"],
      "functionFailoverRegions": ["lhr1"]
    }
  }
}
```

Основные регионы: `iad1` (Washington DC), `sfo1` (San Francisco), `cdg1` (Paris), `lhr1` (London), `sin1` (Singapore), `hnd1` (Tokyo), `gru1` (São Paulo).

### Редиректы

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "redirects": [
    { "source": "/old", "destination": "/new", "permanent": true },
    { "source": "/blog/:slug", "destination": "/posts/:slug" },
    {
      "source": "/(.*)",
      "has": [{ "type": "header", "key": "x-vercel-ip-country", "value": "GB" }],
      "destination": "/uk/$1",
      "permanent": false
    }
  ]
}
```

`permanent: true` → 308, `permanent: false` → 307. Используй `statusCode` для 301/302.

### Rewrites

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" },
    { "source": "/api/:path*", "destination": "https://api.example.com/:path*" },
    {
      "source": "/dashboard",
      "missing": [{ "type": "cookie", "key": "auth_token" }],
      "destination": "/login"
    }
  ]
}
```

### Заголовки

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31556952, immutable" }
      ]
    }
  ]
}
```

### Cron Jobs

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/cron/daily", "schedule": "0 0 * * *" },
    { "path": "/api/cron/hourly", "schedule": "0 * * * *" },
    { "path": "/api/cron/weekly", "schedule": "0 0 * * 1" }
  ]
}
```

Управление через CLI:
```bash
vercel crons ls
vercel crons add --path /api/cron --schedule "0 10 * * *"
vercel crons run /api/cron   # ручной запуск
```

### URL-нормализация

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "cleanUrls": true,
  "trailingSlash": false
}
```

`cleanUrls: true` → убирает `.html` расширения.
`trailingSlash: false` → редирект с `/path/` на `/path`.

### Оптимизация изображений

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "images": {
    "sizes": [256, 640, 1080, 2048, 3840],
    "formats": ["image/webp", "image/avif"],
    "minimumCacheTTL": 60,
    "remotePatterns": [
      {
        "protocol": "https",
        "hostname": "example.com",
        "pathname": "^/images/.*$"
      }
    ]
  }
}
```

---

## Домены

```bash
vercel domains ls                     # Список доменов
vercel domains add example.com        # Добавить домен к проекту
vercel domains rm example.com         # Удалить домен
vercel domains buy example.com        # Купить домен
vercel domains check example.com      # Проверить доступность
vercel domains price example.com      # Узнать цену

# DNS записи
vercel dns ls example.com
vercel dns add example.com @ A 1.2.3.4
vercel dns add example.com www CNAME example.com
vercel dns rm [record-id]

# Алиасы (alias = кастомный домен для деплоя)
vercel alias set [deployment-url] example.com
vercel alias ls
vercel alias rm example.com

# SSL сертификаты
vercel certs ls
vercel certs issue example.com
vercel certs rm [cert-id]
```

---

## Логи и отладка

```bash
vercel logs [deployment-url]          # Логи деплоя
vercel logs [deployment-url] --follow # В реальном времени

vercel traces get [request-id]        # Трейс конкретного запроса

# Метрики
vercel metrics vercel.request.count
vercel metrics schema

# Алерты
vercel alerts
vercel alerts --project [name]

# HTTP-статистика
vercel httpstat /api/health
vercel curl /api/test                 # Запрос с обходом Deployment Protection
```

---

## Локальная разработка

```bash
vercel dev                   # Запуск локального сервера (реплицирует Vercel окружение)
vercel dev --port 3000       # На конкретном порту

vercel env pull              # Скачать dev-переменные окружения
```

`vercel dev` автоматически загружает Development переменные окружения в память — `vercel env pull` для этого не нужен.

---

## Проекты и команды

```bash
vercel project ls            # Список проектов
vercel project add           # Создать проект
vercel project rm            # Удалить проект
vercel project inspect [name]

vercel teams list
vercel teams add
vercel teams invite [email]
vercel switch [team]         # Переключиться между командами

vercel whoami
vercel tokens ls
vercel tokens add "CI token"
vercel tokens rm [token-id]
```

---

## Edge Config

```bash
vercel edge-config list
vercel edge-config add flags                    # Создать Edge Config store
vercel edge-config items flags --key betaEnabled # Читать элемент
vercel edge-config tokens flags --add "Read token"
```

---

## Blob Storage

```bash
vercel blob list
vercel blob put ./file.png
vercel blob get [url]
vercel blob del [url]
vercel blob copy [from-url] [to-pathname]
```

---

## CI/CD паттерны

### GitHub Actions

```yaml
- name: Deploy to Vercel
  run: vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }}
  env:
    VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
    VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

### Получить URL деплоя

```bash
DEPLOYMENT_URL=$(vercel deploy --token=$VERCEL_TOKEN 2>&1 | tail -1)
echo "Deployed to: $DEPLOYMENT_URL"
```

### Пропуск сборки (monorepo)

```json
{
  "ignoreCommand": "git diff --quiet HEAD^ HEAD -- . ':(exclude)../other-app'"
}
```

---

## Workflow для этого проекта (Next.js + Supabase)

### Первичная настройка

```bash
# 1. Привязать проект
vercel link

# 2. Скачать переменные окружения
vercel env pull .env.local

# 3. Убедиться что NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY есть
cat .env.local
```

### Деплой

```bash
# Preview (для тестирования)
vercel

# Production
vercel --prod
```

### Добавление переменных из Supabase

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production  # только server-side!
vercel env add NEXT_PUBLIC_SITE_URL production
```

---

## Частые проблемы

| Проблема | Решение |
|----------|---------|
| Build fails: "Module not found" | Проверь `installCommand` в vercel.json, убедись что зависимость в `dependencies` (не `devDependencies`) |
| Env vars не работают в браузере | Добавь префикс `NEXT_PUBLIC_` |
| 404 на динамических роутах | Добавь `rewrites: [{ source: "/(.*)", destination: "/index.html" }]` для SPA |
| Edge Function превышает лимит 5KB env | Используй Edge Config вместо env vars для больших значений |
| Функция таймаутится | Увеличь `maxDuration` в `functions` секции vercel.json |
| Нет CORS | Добавь `headers` с `Access-Control-Allow-Origin` в vercel.json |

---

## Полезные ссылки

- Документация: https://vercel.com/docs
- CLI Reference: https://vercel.com/docs/cli
- vercel.json schema: https://openapi.vercel.sh/vercel.json
- Регионы: https://vercel.com/docs/functions/regions
- Cron expressions: https://vercel.com/docs/cron-jobs#cron-expressions
