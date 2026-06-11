# Перенос ProContent на Hetzner (Self-Hosted Supabase)

Полное руководство по миграции базы данных и Storage из Supabase Cloud на собственный сервер Hetzner.

## Требования

- Аккаунт Hetzner (hetzner.com)
- SSH-ключ для доступа к серверу
- Бэкап в папке `supabase-backup/backups/20260516_062932/`
- ~4-6 GB RAM на сервере (минимум для self-hosted Supabase)

## Общий план

1. Создать VPS на Hetzner (Ubuntu 24.04)
2. Установить Docker + Docker Compose
3. Загрузить конфиги на сервер
4. Сгенерировать ключи и настроить `.env`
5. Запустить self-hosted Supabase
6. Восстановить структуру БД (миграции)
7. Восстановить данные из SQL дампов
8. Восстановить Storage файлы
9. Настроить домен + SSL (Caddy / Nginx)
10. Обновить `.env` приложения ProContent

---

## Шаг 1. Создание VPS на Hetzner

1. Войдите в [Hetzner Cloud Console](https://console.hetzner.cloud/)
2. Создайте новый проект (или используйте существующий)
3. Добавьте SSH-ключ (Project → Security → SSH Keys)
4. Создайте сервер:
   - **Location**: Falkenstein или Helsinki (ближе к вашим пользователям)
   - **Type**: Shared vCPU (CX21 или CPX21 — 2 vCPU, 4 GB RAM)
   - **Image**: Ubuntu 24.04 LTS
   - **Volume**: 40-80 GB (зависит от размера Storage)
   - **Firewall**: добавьте правила для 22, 80, 443, 8000, 5432 (при необходимости)
5. Сохраните IP-адрес сервера

---

## Шаг 2. Установка Docker и Docker Compose

Подключитесь к серверу по SSH и выполните:

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Docker
sudo apt install -y ca-certificates curl gnupg lsb-release
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Проверка
sudo docker --version
sudo docker compose version
```

---

## Шаг 3. Загрузка конфигов на сервер

На вашем локальном компьютере (Windows, PowerShell):

```powershell
# Замените YOUR_SERVER_IP на IP Hetzner
$server = "root@YOUR_SERVER_IP"

# Создаем папку на сервере
ssh $server "mkdir -p /opt/supabase"

# Копируем конфиги
scp -r hetzner-deploy/* $server:/opt/supabase/

# Копируем бэкап БД (SQL дампы)
scp -r supabase-backup/backups/20260516_062932/*.sql $server:/opt/supabase/backups/

# Копируем миграции проекта
scp -r supabase/migrations $server:/opt/supabase/
```

> **Примечание**: Storage файлы (~2.5 GB) копируются отдельно (см. Шаг 8).

---

## Шаг 4. Настройка `.env` и генерация ключей

На сервере:

```bash
cd /opt/supabase

# Устанавливаем права на выполнение скриптов
chmod +x gen-keys.sh restore-db.sh restore-storage.sh
chmod +x volumes/api/kong-entrypoint.sh

# Генерация ключей
bash gen-keys.sh > generated_keys.txt

# Создаем .env из шаблона
cp env.example .env

# Редактируем .env
nano .env
```

**Обязательно замените в `.env`:**

```
# Вставьте сгенерированные ключи из generated_keys.txt
JWT_SECRET=...
ANON_KEY=...
SERVICE_ROLE_KEY=...
SECRET_KEY_BASE=...

# Пароли (придумайте свои)
POSTGRES_PASSWORD=...
DASHBOARD_PASSWORD=...

# IP вашего сервера Hetzner
API_EXTERNAL_URL=http://YOUR_SERVER_IP:8000
SUPABASE_PUBLIC_URL=http://YOUR_SERVER_IP:8000
SITE_URL=http://YOUR_SERVER_IP:3000
```

Сохраните (`Ctrl+O`, `Enter`, `Ctrl+X`).

---

## Шаг 5. Запуск self-hosted Supabase

```bash
cd /opt/supabase

# Запуск (первый запуск может занять 3-5 минут)
sudo docker compose up -d

# Проверка статуса
sudo docker compose ps
sudo docker compose logs -f
```

Когда все контейнеры будут `healthy`, Supabase готов:

- **Studio (UI)**: http://YOUR_SERVER_IP:8000
- **API (Kong)**: http://YOUR_SERVER_IP:8000
- **PostgreSQL**: YOUR_SERVER_IP:5432

---

## Шаг 6. Восстановление структуры БД (миграции)

```bash
cd /opt/supabase
bash restore-db.sh
```

Скрипт выполнит:
1. Применение всех миграций из `migrations/`
2. Очистку таблиц от тестовых данных
3. Загрузку данных из SQL дампов бэкапа

---

## Шаг 7. Проверка данных

```bash
# Подключение к БД
sudo docker exec -it supabase-db psql -U postgres -d postgres

-- Проверка
\dt public.*
SELECT COUNT(*) FROM posts;
SELECT COUNT(*) FROM profiles;
SELECT COUNT(*) FROM post_media;

-- Выход
\q
```

---

## Шаг 8. Восстановление Storage файлов

Storage файлы (~2.5 GB) копируются отдельно:

```powershell
# На локальном компьютере (PowerShell)
$server = "root@YOUR_SERVER_IP"
scp -r supabase-backup/backups/20260516_062932/storage $server:/opt/supabase/backups/20260516_062932/
```

На сервере:

```bash
cd /opt/supabase
bash restore-storage.sh
```

Скрипт скопирует файлы в `volumes/storage/default/` и перезапустит storage контейнер.

---

## Шаг 9. Настройка SSL и домена (рекомендуется)

Для production необходимо настроить HTTPS и домен. Варианты:

### Вариант A: Caddy (рекомендуется)

```bash
# Установка Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# Настройка Caddy
sudo tee /etc/caddy/Caddyfile <<'EOF'
your-domain.com {
    reverse_proxy localhost:8000
}
EOF

sudo systemctl restart caddy
```

### Вариант B: Cloudflare Tunnel (простейший)

1. Установите `cloudflared`
2. Создайте tunnel
3. Укажите `http://localhost:8000` как origin

После настройки домена обновите `.env`:

```bash
API_EXTERNAL_URL=https://your-domain.com
SUPABASE_PUBLIC_URL=https://your-domain.com
SITE_URL=https://your-domain.com
```

Перезапустите:

```bash
sudo docker compose down
sudo docker compose up -d
```

---

## Шаг 10. Обновление приложения ProContent

В проекте ProContent измените `.env.local` (или `.env`):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-domain.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

> Ключи (`ANON_KEY`, `SERVICE_ROLE_KEY`) берутся из файла `.env` на сервере Hetzner.

Пересоберите и задеплойте приложение:

```bash
npm run build
```

---

## Шаг 11. Настройка email (SMTP + кастомные шаблоны)

GoTrue отправляет письма (восстановление пароля и т.д.) через SMTP. По
умолчанию указан несуществующий контейнер `supabase-mail` → письма не уходят
(HTTP 500). Настраиваем реальный SMTP через **Resend**.

### 11.1. SMTP через Resend

В `.env` (значения уже в `env.example`):

```
SMTP_ADMIN_EMAIL=noreply@procontent.si
SMTP_HOST=smtp.resend.com
SMTP_PORT=587            # ВАЖНО: порт 465 Hetzner блокирует, используем 587 (STARTTLS)
SMTP_USER=resend
SMTP_PASS=re_...         # Resend API key
SMTP_SENDER_NAME=ProContent
```

> Домен отправителя должен быть верифицирован в Resend (DKIM + SPF на
> `send.<domain>`). Проверка: `nslookup -type=TXT send.procontent.si`.

### 11.2. Кастомный шаблон письма recovery

`GOTRUE_MAILER_TEMPLATES_*` принимает **только HTTP(S)-URL** — file-путь GoTrue
приклеивает к `SITE_URL` и грузит не тот контент (страницу login). Поэтому
шаблон отдаётся отдельным nginx-контейнером `email-templates` по внутреннему
docker-DNS:

- Сервис `email-templates` (см. `docker-compose.yml`) монтирует
  `./volumes/auth/templates` и отдаёт файлы по `http://email-templates/...`
- `.env`:
  ```
  MAILER_SUBJECTS_RECOVERY=Ponastavitev gesla za PROCONTENT
  MAILER_TEMPLATES_RECOVERY=http://email-templates/recovery.html
  ```
- Файл шаблона: `volumes/auth/templates/recovery.html` (в дизайн-схеме проекта;
  ведёт на `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/update-password`)

### 11.3. Применение изменений

```bash
cd /opt/supabase
docker compose up -d email-templates
docker compose restart auth      # сброс in-memory кэша шаблонов GoTrue
docker compose restart kong      # ВАЖНО: Kong кэширует IP auth → иначе 502
```

> После любого пересоздания `auth` перезапускайте `kong` — иначе он стучится
> на старый IP контейнера (`502 connection refused`).
>
> GoTrue ограничивает отправку ~1 письмо/60 сек на адрес (429 — это норма).

---

## Шаг 12. Edge Function `generate-thumbnail` (server-side fallback постеров)

Strežniška генерация poster'ов (Story 8.5): когда клиентская Canvas-генерация не
справилась (MOV/HEVC, большой файл, CORS), Vercel-route
`/api/admin/generate-thumbnail-fallback` зовёт Edge Function `generate-thumbnail`,
которая извлекает кадр (ffmpeg.wasm single-thread), кодирует JPEG 640×360 и
сохраняет в `post_media/thumbnails/{id}_thumb.jpg` + `post_media.thumbnail_url`.

### 12.1. Env (уже в `docker-compose.official.yml`, сервис `functions`)

Дополнительных переменных не требуется — функция читает уже заданные:

```
JWT_SECRET                 # верификация HS256-подписи Bearer-токена (defense-in-depth)
SUPABASE_URL=http://kong:8000   # internal — Storage/DB-операции под service_role
SUPABASE_PUBLIC_URL        # публичный хост — SSRF-allowlist для video_url
SUPABASE_SERVICE_ROLE_KEY  # service_role (обход RLS для upload + update)
FUNCTIONS_VERIFY_JWT=true  # gateway проверяет ТОЛЬКО подпись (любой валидный JWT)
```

> `VERIFY_JWT=true` на gateway пропускает любой валидный JWT (в т.ч. токен обычного
> участника), поэтому функция **сама** проверяет `role === 'service_role'` → иначе `403`.

### 12.2. Синхронизация артефакта функции на сервер

Исходник функции версионируется в репозитории в `supabase/functions/` и
**синхронизирован** в `hetzner-deploy/volumes/functions/` (монтируется в контейнер
как `/home/deno/functions`). Дерево:

```
volumes/functions/
  main/index.ts                  # router (--main-service), worker на запрос
  _shared/validation.ts          # JWT/SSRF/path-хелперы (общие с Next.js по контракту)
  generate-thumbnail/index.ts    # обработчик: validate → download → extract → upload → update
  generate-thumbnail/extractFrame.ts  # движок ffmpeg.wasm single-thread
```

Деплой на сервер (с локальной машины, PowerShell):

```powershell
$server = "root@YOUR_SERVER_IP"
scp -r hetzner-deploy/volumes/functions/* $server:/opt/supabase/volumes/functions/
```

### 12.3. Рестарт контейнера и проверка

```bash
cd /opt/supabase
docker compose restart functions
docker compose logs -f functions    # ждём "main function started" / отсутствие ошибок загрузки

# Smoke-test (изнутри сети, под service_role — публичный путь через Kong):
curl -i -X POST "$SUPABASE_PUBLIC_URL/functions/v1/generate-thumbnail" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"post_media_id":"<id>","video_url":"<SUPABASE_PUBLIC_URL>/storage/v1/object/public/post_media/posts/.../clip.mp4"}'
# → 200 { "thumbnail_url": "..." }
```

### 12.4. Env приложения (Vercel)

Контракт вызывается тонким клиентом `src/lib/media/serverThumbnail.ts` (server-only):

```
NEXT_PUBLIC_SUPABASE_URL        # уже есть — база для {url}/functions/v1
SUPABASE_SERVICE_ROLE_KEY       # уже есть — Bearer для Edge Function
SUPABASE_FUNCTIONS_URL          # опционально — переопределить базовый URL функций
SERVER_THUMBNAIL_TIMEOUT_MS     # опционально — таймаут вызова (по умолчанию 25000)
```

> **ffmpeg.wasm-риск (Story 8.5).** Извлечение кадра в `supabase/edge-runtime` для
> тяжёлых/экзотических файлов может упереться в лимиты CPU/памяти — это **ожидаемо**
> и покрыто graceful degradation 8.1 (публикация сохраняется без poster + toast,
> poster добавляется позже через 8.2/8.3/8.4). Если на стенде движок нестабилен —
> escape hatch: вынести генерацию во внешний Node+ffmpeg-static сервис за тем же
> HTTP-контрактом, **не меняя** вызывающих (`serverThumbnail.ts`, route, 8.3).

---

## Управление сервером

### Полезные команды

```bash
# Статус контейнеров
sudo docker compose ps

# Логи
sudo docker compose logs -f

# Логи конкретного сервиса
sudo docker compose logs -f db

# Перезапуск
sudo docker compose restart

# Полный сброс (удалит все данные!)
sudo docker compose down -v
rm -rf volumes/db/data
```

### Бэкап на Hetzner

```bash
# Бэкап БД
sudo docker exec supabase-db pg_dump -U postgres -d postgres > backup_$(date +%Y%m%d).sql

# Бэкап Storage
sudo tar czf storage_backup_$(date +%Y%m%d).tar.gz volumes/storage/
```

---

## Решение проблем

| Проблема | Решение |
|----------|---------|
| `docker compose up` зависает | Проверьте RAM (`free -h`), нужно минимум 4 GB |
| Studio не открывается | Проверьте firewall Hetzner (порт 8000) |
| Нет прав на volumes | `sudo chown -R 1000:1000 volumes/` |
| PostgreSQL не стартует | Проверьте `sudo docker compose logs db` |
| Storage файлы не видны | Перезапустите storage: `sudo docker compose restart storage` |
| Ошибки RLS после restore | Проверьте, что миграции применены полностью |

---

## Архитектура развертывания

```
┌─────────────────┐
│   Hetzner VPS   │
│  Ubuntu 24.04   │
│                 │
│  ┌───────────┐  │
│  │   Caddy   │  │  ← HTTPS + домен
│  │ (reverse  │  │
│  │  proxy)   │  │
│  └─────┬─────┘  │
│        │        │
│  ┌─────┴─────┐  │
│  │   Kong    │  │  ← API Gateway (порт 8000)
│  │ (8000)    │  │
│  └─────┬─────┘  │
│        │        │
│  ┌─────┴─────┐  │
│  │  Supabase │  │  ← Docker Compose
│  │  Services │  │     - PostgreSQL
│  │           │  │     - Auth (GoTrue)
│  │           │  │     - PostgREST
│  │           │  │     - Storage
│  │           │  │     - Realtime
│  │           │  │     - Studio
│  └───────────┘  │
└─────────────────┘
```

---

## Контакты и поддержка

- Документация Supabase Self-Hosted: https://supabase.com/docs/guides/self-hosting
- Официальный репозиторий: https://github.com/supabase/supabase/tree/master/docker
