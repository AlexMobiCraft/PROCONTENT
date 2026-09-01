# Story 8.3: Retroaktivna generacija thumbnailov za obstoječe objekte

Status: ready-for-dev

## Story

Как администратор,
я хочу иметь возможность запустить массовую генерацию недостающих poster для всех существующих видеозаписей,
чтобы мне не приходилось вручную открывать каждую публикацию и исправлять poster (например, после Telegram-миграции).

## Acceptance Criteria

**Given** в базе существует 50+ видео без `thumbnail_url` (например, после Telegram-миграции)  
**When** администратор открывает admin panel → Orodja → "Generiraj manjkajoče postere" и нажимает "Zaženi zdaj"  
**Then** отображается progress bar и система начинает обрабатывать видео  
**And** обрабатывается максимум 5 видео одновременно  
**And** каждое успешно обработанное видео получает `thumbnail_url`  
**And** в конце отображается отчёт: "45/50 uspešno, 5 napak" со списком ID неуспешных

**Given** администратор хочет запустить команду ещё раз  
**When** нажимает "Zaženi zdaj"  
**Then** пропускаются все видео, которые уже имеют `thumbnail_url`  
**And** обрабатываются только необработанные

**Given** во время выполнения происходит ошибка при одном видео (например, повреждённый файл)  
**When** ошибка возникает  
**Then** обработка не прерывается  
**And** ошибка записывается в отчёт  
**And** продолжается со следующим видео

**Given** процесс прерывается (например, закрытие браузера, перезапуск сервера)  
**When** запускается в следующий раз  
**Then** продолжается с места прерывания — пропускаются уже обработанные видеозаписи

**Given** администратор не аутентифицирован или не имеет role admin  
**When** пытается получить доступ к панели или запустить генерацию  
**Then** отображается ошибка "Dostop zavrnjen" или происходит перенаправление на страницу входа

## Tasks / Subtasks

- [ ] Task 1: Admin panel UI для bulk-генерации (AC: 1, 2)
  - [ ] Subtask 1.1: Создать `src/features/admin/components/BulkThumbnailPanel.tsx` — Smart Container, отображающий:
    - Заголовок: "Generiraj manjkajoče postere"
    - Подзаголовок: количество видео без poster (динамически из базы)
    - Кнопка: "Zaženi zdaj" (отключена во время выполнения)
    - Progress bar во время выполнения
    - Результат: количество успешно обработанных / неуспешных
  - [ ] Subtask 1.2: Добавить карточку в admin panel под вкладку "Orodja" (или существующую вкладку)
  - [ ] Subtask 1.3: Обеспечить responsive design и touch target'ы (min 44×44 px)
- [ ] Task 2: API для массовой генерации (AC: 1, 3, 4, 5)
  - [ ] Subtask 2.1: Создать `src/app/api/admin/bulk-generate-thumbnails/route.ts` — Route Handler, который:
    - Проверяет admin-аутентификацию
    - Находит все `post_media` с `media_type = 'video'` и `thumbnail_url IS NULL`
    - Для каждого видео генерирует thumbnail (Canvas на сервере или внешний сервис)
    - Ограничивает параллелизм на max 5 одновременных процессов
    - Возвращает отчёт: `{ processed: number, success: number, failed: number, errors: Array<{id, error}> }`
  - [ ] Subtask 2.2: Реализовать rate limiting: 200ms задержка между последовательными вызовами (защита от перегрузки)
  - [ ] Subtask 2.3: Error handling: отдельная ошибка не прерывает весь процесс
- [ ] Task 3: Standalone скрипт для ретроактивной обработки (AC: 1, 2, 3, 4)
  - [ ] Subtask 3.1: Создать `scripts/generate-missing-thumbnails.ts` — TypeScript скрипт, выполняющийся вне production:
    - Подключается к Supabase (service role key из `.env.local`)
    - Находит все видео без `thumbnail_url`
    - Для каждого видео генерирует thumbnail и загружает в Storage
    - Возвращает консольный отчёт
  - [ ] Subtask 3.2: Добавить npm скрипт: `"generate-thumbnails": "tsx scripts/generate-missing-thumbnails.ts --env=.env.local"`
  - [ ] Subtask 3.3: Скрипт должен поддерживать resume — сохранять состояние обработанных ID (например, во временный файл или просто пропускать уже существующие `thumbnail_url`)
- [ ] Task 4: Генерация thumbnail на сервере (AC: 1, 3)
  - [ ] Subtask 4.1: Реализовать server-side генерацию для bulk-обработки. Варианты:
    - **Option A:** Использовать `ffmpeg.wasm` в Deno окружении (Supabase Edge Function)
    - **Option B:** Использовать внешний сервис (например, Hetzner-deployed service — проект уже имеет `hetzner-deploy/`)
    - **Option C:** Скачать видео на сервер, использовать `canvas` в Node.js с `canvas` npm пакетом
  - [ ] Subtask 4.2: Сгенерированное изображение должно быть: JPEG, качество 85 %, 640×360 px, первый кадр при currentTime = 0.1s
- [ ] Task 5: Интеграция с Storage и базой (AC: 1, 2)
  - [ ] Subtask 5.1: Проверить, что thumbnail'ы сохраняются по тому же пути: `post_media/thumbnails/{post_media_id}_thumb.jpg`
  - [ ] Subtask 5.2: Проверить идемпотентность — повторный запуск не создаёт дубликатов
  - [ ] Subtask 5.3: Проверить, что `thumbnail_url` обновляется в таблице `post_media`
- [ ] Task 6: Тесты
  - [ ] Subtask 6.1: Unit-тесты для bulk API (mock Supabase client, проверить параллелизм)
  - [ ] Subtask 6.2: Тест для error handling — проверить, что одна ошибка не прерывает остальные
  - [ ] Subtask 6.3: Тест для admin аутентификации — неавторизованный вызов возвращает 401
  - [ ] Subtask 6.4: E2E-тест: admin открывает panel, запускает генерацию, проверяет результат

## Dev Notes

### Архитектурный контекст и ограничения

- **Stack:** Next.js 16.1.6, TypeScript 5, Supabase (Auth, DB, Storage), Zustand 5.
- **Server:** Next.js Route Handlers (`src/app/api/admin/*`) для admin API. Supabase Edge Functions для heavy processing (если используется).
- **Vercel ограничения:** Vercel Function имеет 10s timeout (Hobby) и ограничение RAM (~1GB). `ffmpeg.wasm` требует 100-200 MB RAM — при одновременных вызовах (bulk) происходит OOM. **Поэтому:**
  - Bulk генерация НЕ должна выполняться в Vercel Function с `ffmpeg.wasm`.
  - Использовать **Supabase Edge Function** или **standalone скрипт** (`scripts/generate-missing-thumbnails.ts`) с `tsx`.
- **Hetzner:** Проект имеет `hetzner-deploy/` директорию. Если существует уже deployan сервис, его можно использовать для bulk генерации.
- **Snake_case:** Все поля из базы в `snake_case`.

### Ключевые реализационные моменты

1. **Параллелизм:** Ограничить на max 5 одновременных процессов (NFR8.3). Использовать `p-limit` или подобную библиотеку для ограничения параллельных операций.
2. **Rate limiting:** 200ms задержка между последовательными вызовами (NFR8.3). Это предотвращает перегрузку Storage и Edge Function.
3. **Error containment:** Отдельная ошибка при одном видео НЕ должна прерывать весь процесс. Использовать `Promise.allSettled` или `try/catch` внутри каждой итерации.
4. **Resume:** Скрипт должен быть идемпотентным. Так как проверяется `thumbnail_url IS NULL`, повторный запуск автоматически пропускает уже обработанные.
5. **SLA:** Обработка 100 видео НЕ должна занимать более 10 минут (NFR8.3). При 5 одновременных процессах и 200ms задержки = ~20s + время генерации. Проверить, что это в пределах.
6. **Admin аутентификация:** ВСЕ admin endpoint'ы ДОЛЖНЫ проверять `role === 'admin'` с `await createClient()` + `getUser()`.

### Storage и база

- **Индекс:** `CREATE INDEX IF NOT EXISTS idx_post_media_missing_thumbnail ON public.post_media(media_type, thumbnail_url) WHERE media_type = 'video' AND thumbnail_url IS NULL` — этот индекс ускоряет запрос для необработанных видео.
- **Путь:** `post_media/thumbnails/{post_media_id}_thumb.jpg`
- **RLS:** Admin может писать, public может читать.

### Варианты реализации server-side генерации

| Вариант | Преимущества | Недостатки | Рекомендация |
|---------|------------|------------|--------------|
| **Supabase Edge Function + ffmpeg.wasm** | Меньше потребление RAM чем в Node.js, независимо от Vercel | Deno/Edge Function ограничения, требуется конфигурация | **Рекомендуется** для fallback и bulk |
| **Standalone скрипт (tsx + canvas)** | Полный контроль, выполняется локально или на Hetzner | Требует Node.js окружение с `canvas` пакетом | **Рекомендуется** для разовой bulk-акции |
| **Vercel Route Handler + ffmpeg.wasm** | Просто интегрировать | OOM при bulk, 10s timeout | **Не рекомендуется** для bulk |

**Рекомендация для v1:**
- Для **standalone bulk** использовать `scripts/generate-missing-thumbnails.ts` с `canvas` npm пакетом (или `ffmpeg-static`).
- Для **admin UI кнопки** отправить запрос на `POST /api/admin/bulk-generate-thumbnails`, который запускает ту же логику (можно асинхронно — например, с использованием `fetch` из Route Handler на самого себя или с queue системой).

### UI / Slovenian Language

- Kartica v admin panelu:
  - Naslov: "Generiraj manjkajoče postere"
  - Podnaslov: "Najdeno X video brez posterja" (ali "Ni manjkajočih posterjev")
  - Gumb: "Zaženi zdaj"
  - Progress: "Obdelujem X / Y..."
  - Rezultat: "X uspešno, Y napak"
- Toast napaka: "Napaka pri generiranju. Poskusite znova."

### Testing Notes

- **Unit-тесты:** Mock 10 видео-записей, проверить, что обрабатываются все, ошибка при одном не прерывает остальные.
- **API-тесты:** Проверить admin аутентификацию (401 для не-admin).
- **E2E-тесты:** Playwright — admin кликает "Zaženi zdaj", проверить progress bar и конечный результат.

### References

- [Source: _bmad-output/planning-artifacts/prd-video-thumbnails.md#FR8.4]
- [Source: _bmad-output/planning-artifacts/prd-video-thumbnails.md#NFR8.3]
- [Source: _bmad-output/planning-artifacts/prd-video-thumbnails.md#NFR8.5]
- [Source: _bmad-output/planning-artifacts/prd-video-thumbnails.md#UX-DR8.4]
- [Source: _bmad-output/planning-artifacts/architecture.md#Smart Container / Dumb UI]
- [Source: _bmad-output/planning-artifacts/architecture.md#Storage Bucket Architecture]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: hetzner-deploy/]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
