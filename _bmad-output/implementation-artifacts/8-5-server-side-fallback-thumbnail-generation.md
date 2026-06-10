---
baseline_commit: 65614c74400770de827370694ac1aa24182043ee
---

# Story 8.5: Strežniška generacija posterja (fallback) prek Supabase Edge Function

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Как автор/администратор,
я хочу, чтобы при сбое клиентской Canvas-генерации система всё же создавала poster на сервере (извлекала кадр из видео),
чтобы видео с экзотическим кодеком (MOV/HEVC), большим размером или CORS-проблемой тоже получали корректный thumbnail, а не оставались без превью.

**Происхождение:** эта story реализует отложенный scope Story 8.1. В 8.1 endpoint `POST /api/admin/generate-thumbnail-fallback` — это skeleton-задел: auth/admin/body/SSRF-валидация готовы, но реальное извлечение кадра возвращает `501`. Здесь skeleton превращается в работающий движок, оформленный **за стабильным HTTP-контрактом**, который переиспользует и save-time fallback (8.1), и ретроактивный bulk (Story 8.3).

## Архитектурное решение (зафиксировано пользователем)

**Вариант A — Supabase Edge Function (Deno) + ядро-за-HTTP-контрактом.**

- Движок генерации живёт в **Supabase Edge Function** `generate-thumbnail` на self-hosted стеке Hetzner (контейнер `supabase-edge-functions`, `edge-runtime`), **рядом с данными** (Storage + DB на том же хосте) → быстрый I/O, без интернет-egress, без нагрузки на Vercel.
- Next.js-приложение (Vercel) **не генерирует кадр сам** — оно вызывает Edge Function по HTTP.
- Контракт фиксирован и не зависит от рантайма движка:

```
POST {SUPABASE_FUNCTIONS_URL}/functions/v1/generate-thumbnail
  Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
  body: { post_media_id: string, video_url: string }
  → 200 { thumbnail_url: string }
  → 4xx/5xx { error: string }
```

- **Переиспользуемое ядро = этот контракт.** Потребители:
  - **8.1 save-time fallback** (эта story): Vercel route `/api/admin/generate-thumbnail-fallback` проксирует вызов.
  - **8.3 bulk** (будущая story): bulk-route/скрипт зовёт ту же Edge Function N раз с параллелизмом ≤5.
- **Escape hatch:** если `edge-runtime` не потянет `ffmpeg.wasm` надёжно (нет потоков/`SharedArrayBuffer`, лимиты памяти/CPU на тяжёлых файлах), движок заменяется на внешний Node-сервис (Вариант C) **без изменения вызывающих** — контракт за HTTP это позволяет. Это план Б, не блокер story.

## Acceptance Criteria

### AC1 — Реальная генерация заменяет `501` в fallback-роуте

**Given** валидный серверный/admin-вызов `POST /api/admin/generate-thumbnail-fallback` с `{ videoUrl, postMediaId }`, где `videoUrl` — видео из `post_media/posts/` (`.mp4/.mov/.webm`)
**When** endpoint обрабатывает запрос
**Then** вместо `501` он вызывает Edge Function `generate-thumbnail`, которая извлекает кадр при `currentTime = 0.1s`, кодирует JPEG **640×360 px, качество 85 %, ≤150 KB**, загружает в `post_media/thumbnails/{postMediaId}_thumb.jpg` (upsert) и обновляет `post_media.thumbnail_url` публичным URL
**And** endpoint возвращает `200 { thumbnail_url }`
**And** **все существующие проверки 8.1 сохранены без изменений**: `401` без user, `403` для не-admin, `400` на битый/`null`/не-объект body, `400` на отсутствие полей, `400` SSRF (чужой домен/bucket, signed-путь, thumbnail-объект, не-video расширение)

### AC2 — Edge Function: контракт, безопасность, обработка ошибок

**Given** Edge Function `generate-thumbnail` развёрнута в self-hosted стеке (`volumes/functions`) с `VERIFY_JWT=true`
**When** она получает запрос
**Then** она **сама** декодирует JWT из `Authorization: Bearer …` (верификация HS256 подписи c `JWT_SECRET` из env контейнера) и принимает запрос **только** при claim `role === 'service_role'`; запрос с обычным пользовательским JWT отклоняется `403` — **defense-in-depth**, т.к. gateway (`VERIFY_JWT=true`) проверяет лишь *подпись* и пропускает любой валидный JWT, включая токен обычного залогиненного участника
**And** повторно применяет SSRF-allowlist на `video_url`, сверяя с **публичным** хостом `SUPABASE_PUBLIC_URL` (т.к. `video_url` приходит с публичного хоста, напр. `https://api.procontent.si`): только `{SUPABASE_PUBLIC_URL}/storage/v1/object/public/post_media/posts/…` + расширение `.mp4/.mov/.webm`
**And** создаёт Deno supabase-client `createClient(SUPABASE_URL /* internal http://kong:8000 */, SERVICE_ROLE_KEY)` и через него скачивает видео, загружает thumbnail в Storage и обновляет `thumbnail_url` под `service_role` (обход RLS — консистентно с правилом проекта)
**And** при сбое любого шага (download/decode/upload/update) возвращает структурированный `{ error }` с корректным кодом (`4xx` для входных проблем, `5xx`/`502` для сбоя движка) — **не падает молча и не отдаёт ложный `200`**

### AC3 — Переиспользуемый тонкий клиент (HTTP-контракт)

**Given** контракт должен переиспользоваться 8.1 и 8.3 без дублирования движка
**When** реализуется вызывающая сторона в Next.js
**Then** создаётся `src/lib/media/serverThumbnail.ts` → `requestServerThumbnail({ postMediaId, videoUrl }): Promise<{ thumbnail_url: string }>`, который POST-ит на `${SUPABASE_FUNCTIONS_URL ?? `${NEXT_PUBLIC_SUPABASE_URL}/functions/v1`}/generate-thumbnail` с `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, принимает `AbortSignal`, маппит не-`ok` ответ в ошибку
**And** env-guard (`NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`) выполнен **вне** `try/catch` (правило проекта — конфиг-ошибки не должны замалчиваться)
**And** `serverThumbnail.ts` помечен **server-only** (`import 'server-only'`): использует `SUPABASE_SERVICE_ROLE_KEY` и **не должен** импортироваться в client-компоненты/браузерный код (иначе секрет утечёт в бандл)
**And** fallback route (server) использует этот клиент; браузерный `postThumbnails.ts` его **не** импортирует — он ходит в route
**And** в Dev Notes/References зафиксировано, что **8.3 bulk обязан звать ту же Edge Function** (concurrency ≤5), а не реализовывать собственный движок

### AC4 — Интеграция с save-time pipeline (8.1) без регрессий

**Given** новое видео при сохранении публикации не получило Canvas-poster (`thumbnail_status === 'error'`), и save-time pipeline вызывает fallback (`runThumbnailTask` → `requestThumbnailFallback`)
**When** fallback **успевает** завершиться успешно в пределах `THUMBNAIL_PIPELINE_BUDGET_MS` (2500 мс)
**Then** `thumbnail_url` уже persisted Edge Function'ом, `runThumbnailTask` возвращает `persisted: true`, `applyNewVideoThumbnails.allPersisted` честно отражает успех → `PostForm` показывает `toast.success`
**And** **если** fallback не уложился в бюджет (тяжёлое/большое видео — типичный случай server-генерации) → задача прерывается `AbortController` (как сейчас), `persisted: false`, публикация сохраняется **без poster** + `toast.warning` (`POSTER_NOT_GENERATED_MESSAGE`) — **graceful degradation из 8.1 не нарушена**; poster добавляется позже через 8.2/8.3/8.4
**And** бюджет save-time pipeline и гарантия «публикация не блокируется навсегда» (8.1) сохранены без изменений
**And** прочие пути `runThumbnailTask` (blob-upload, orphan-cleanup при сбое `updateThumbnailUrl`, abort-семантика) **не затронуты**

### AC5 — Тесты

**Given** изменения покрываются тестами (Vitest)
**Then** `route.test.ts`: тест «`501` для валидного admin-запроса» **заменён** на «`200` + `thumbnail_url`» (с моком `serverThumbnail`/`fetch`), добавлены тесты «сбой Edge Function → `5xx`/`502`» и «таймаут/abort»; **все существующие validation-тесты (401/403/400×7) остаются зелёными**
**And** `serverThumbnail.ts` покрыт unit-тестами: успех; не-`ok` ответ → throw; отсутствие env → понятная ошибка; передача `AbortSignal`
**And** `postThumbnails.test.ts`: успешный in-budget fallback → `persisted:1/allPersisted:true`; прерванный по бюджету fallback → `persisted:0/allPersisted:false` (обновить существующий тест fallback-budget)
**And** для Edge Function (Deno): чистые хелперы (`decodeJwtRole`/`assertServiceRole`/`assertAllowedVideoUrl`/`buildThumbnailPath`) вынесены в `_shared` и покрыты тестами по выбранной стратегии раннера (см. Testing Notes — `deno test` только для `supabase/functions/` ИЛИ чистый TS в Vitest), **включая инвариант** `buildThumbnailPath(id) === getThumbnailStoragePath(id)`; реальное извлечение кадра проверяется **вручную/интеграционно** на стенде (не запускается в Vitest) — результат задокументировать в Completion Notes

## Tasks / Subtasks

- [ ] **Task 1: Edge Function `generate-thumbnail` (Deno)** (AC: 1, 2)
  - [ ] Subtask 1.0 (**сначала, blocking**): Исследовать и зафиксировать библиотеку извлечения кадра, работающую в `supabase/edge-runtime` (см. «КЛЮЧЕВОЙ технический риск»). Критерий: на стенде извлекает кадр из `.mp4` и `.mov`/HEVC без `SharedArrayBuffer`/потоков. Результат записать в Dev Agent Record. Если ни одна не подходит → escape hatch (Вариант C), зафиксировать и продолжить.
  - [ ] Subtask 1.1: Создать `supabase/functions/generate-thumbnail/index.ts` — Deno-обработчик: декодирование+проверка JWT (см. 1.2), парсинг body `{ post_media_id, video_url }`, вызов хелперов валидации, создание Deno supabase-client `createClient(SUPABASE_URL /* internal http://kong:8000 */, SERVICE_ROLE_KEY)`, оркестрация download → extract frame → encode → upload → update, ответ `200 { thumbnail_url }` / `{ error }` с корректным кодом
  - [ ] Subtask 1.2: Создать `supabase/functions/_shared/validation.ts` — чистые хелперы:
    - `decodeJwtRole(authHeader, jwtSecret)` — извлекает `Authorization: Bearer …`, верифицирует HS256 подпись c `JWT_SECRET` (из env контейнера), возвращает claim `role`
    - `assertServiceRole(role)` — `role === 'service_role'` → иначе `403` (defense-in-depth: gateway пропускает ЛЮБОЙ валидный JWT, включая токен участника)
    - `assertAllowedVideoUrl(url, publicUrl)` — сверка с **публичным** хостом `SUPABASE_PUBLIC_URL` (video_url приходит с публичного хоста, не с internal kong): `{publicUrl}/storage/v1/object/public/post_media/posts/` + `.mp4/.mov/.webm`
    - `buildThumbnailPath(postMediaId)` = `thumbnails/{id}_thumb.jpg` — **результат обязан совпадать** с `getThumbnailStoragePath` (Next.js)
  - [ ] Subtask 1.3: Реализовать извлечение кадра выбранной (Subtask 1.0) библиотекой: **только один кадр** `-ss 0.1 -frames:v 1 -s 640x360` (single-thread, без `SharedArrayBuffer`); cover-crop без искажения aspect ratio (как `generateVideoThumbnail.ts`), JPEG q85, цель ≤150 KB
  - [ ] Subtask 1.4: Upload в Storage `post_media/thumbnails/{id}_thumb.jpg` (`upsert: true`, `image/jpeg`) и `update post_media.thumbnail_url` под `service_role`; при 0 обновлённых строк — ошибка (паттерн `updateThumbnailUrl`)
  - [ ] Subtask 1.5: **Идемпотентность + abort** (NFR8.5): `upsert` делает повторный вызов безопасным; обработчик подписан на request `AbortSignal` (клиент может отменить по бюджету 2500 мс) и при abort прекращает работу, не оставляя битого состояния (частичный upload перезаписывается следующим вызовом)
  - [ ] Subtask 1.6: Обеспечить наличие router'а `supabase/functions/main/index.ts` (edge-runtime запускается с `--main-service …/main`), который диспатчит запрос на `generate-thumbnail` по пути
  - [ ] Subtask 1.7: Тесты хелперов `_shared` (`decodeJwtRole`/`assertServiceRole`/`assertAllowedVideoUrl`/`buildThumbnailPath`) — см. Testing Notes (стратегия раннера); включить инвариант-тест `buildThumbnailPath(id) === getThumbnailStoragePath(id)`
- [ ] **Task 2: Тонкий клиент `serverThumbnail.ts`** (AC: 3)
  - [ ] Subtask 2.1: Создать `src/lib/media/serverThumbnail.ts` (**server-only**, первой строкой `import 'server-only'`) → `requestServerThumbnail({ postMediaId, videoUrl }, signal?)`; URL из `SUPABASE_FUNCTIONS_URL ?? ${NEXT_PUBLIC_SUPABASE_URL}/functions/v1`; `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}`; env-guard вне try/catch; парсинг `{ thumbnail_url }`, throw при не-`ok`. **Не импортировать из client-компонентов.**
  - [ ] Subtask 2.2: Unit-тесты `tests/unit/lib/media/serverThumbnail.test.ts` (успех, не-ok → throw, нет env → throw, abort)
- [ ] **Task 3: Подключить fallback-роут к движку (убрать `501`)** (AC: 1, 5)
  - [ ] Subtask 3.1: В `src/app/api/admin/generate-thumbnail-fallback/route.ts` заменить финальный `501` на вызов `requestServerThumbnail(...)`; вернуть `200 { thumbnail_url }`; **сохранить ВСЕ предыдущие проверки** (401/403/400/SSRF). Маппинг ошибок Edge Function: сбой движка/недоступность → `502 { error }`; неожиданный `4xx` от функции (входные данные route уже провалидировал) → залогировать и вернуть `500`; не пробрасывать сырой ответ движка клиенту
  - [ ] Subtask 3.2: Обновить `tests/unit/app/api/admin/generate-thumbnail-fallback/route.test.ts`: `501`→`200`+`thumbnail_url`, добавить edge-error и abort-кейсы, не сломать существующие validation-тесты
- [ ] **Task 4: Save-time pipeline — честный `persisted` для fallback** (AC: 4, 5)
  - [ ] Subtask 4.1: В `src/features/admin/api/postThumbnails.ts` (**браузерный код**) `requestThumbnailFallback` **продолжает** звать Vercel-route `/api/admin/generate-thumbnail-fallback` — **НЕ** `requestServerThumbnail` и **НЕ** Edge Function напрямую (там `service_role` — server-only, см. C/S boundary). При `200` от route → `runThumbnailTask` возвращает `persisted: true`; сохранить abort/budget-семантику, only-on-`error`-вызов, blob-путь и orphan-cleanup без изменений
  - [ ] Subtask 4.2: Обновить `tests/unit/features/admin/api/postThumbnails.test.ts`: успешный in-budget fallback → `persisted:1/allPersisted:true`; прерванный по бюджету → `persisted:0/allPersisted:false`
- [ ] **Task 5: Конфиг, env и деплой** (AC: 2, 3)
  - [ ] Subtask 5.1: Задокументировать env: app (Vercel) — `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (уже есть), опционально `SUPABASE_FUNCTIONS_URL`; стенд (Hetzner functions) — `SERVICE_ROLE_KEY`, `JWT_SECRET`, `SUPABASE_URL=http://kong:8000` (internal, для Storage/DB-операций), `SUPABASE_PUBLIC_URL` (публичный хост, для SSRF-allowlist), `VERIFY_JWT` — уже заданы в `docker-compose.official.yml`
  - [ ] Subtask 5.2: Синхронизировать артефакт функции в `hetzner-deploy/volumes/functions/generate-thumbnail/` (+ `main`, `_shared`) и описать шаг деплоя/рестарта контейнера `supabase-edge-functions` в `hetzner-deploy/README.md`
  - [ ] Subtask 5.3: Проверить **сетевую достижимость** публичного `…/functions/v1/generate-thumbnail` через Kong-gateway с Vercel (server-to-server, CORS не применим) и корректную передачу `Authorization: Bearer SERVICE_ROLE_KEY` (gateway пропускает, функция верифицирует role)
- [ ] **Task 6: Верификация качества** (AC: 1, 2)
  - [ ] Subtask 6.1: `npm run typecheck`, `npx eslint` (изменённые файлы), `npx vitest run` — всё зелёное
  - [ ] Subtask 6.2: Ручная/интеграционная проверка на стенде: MOV/HEVC и большой `.mp4` → fallback создаёт корректный 640×360 JPEG, `thumbnail_url` заполнен, poster виден в ленте; зафиксировать результат в Completion Notes

## Dev Notes

### Архитектурный контекст и ограничения

- **Stack:** Next.js 16.1.6 (App Router) на **Vercel**; Supabase (DB/Storage/edge-runtime) **self-hosted на Hetzner** через `docker-compose.official.yml`. Edge Functions: контейнер `supabase-edge-functions` (`supabase/edge-runtime:v1.71.2`), монтирует `./volumes/functions`, запуск `--main-service /home/deno/functions/main`, `VERIFY_JWT=true`.
- **Движок за HTTP-контрактом** (см. раздел «Архитектурное решение»). Не реализовывать генерацию в Vercel Route Handler — только проксирование на Edge Function.
- **Snake_case:** поля из БД напрямую (`thumbnail_url`, `media_type`, `post_media_id`); без camelCase-мапперов. (Тело контракта использует `post_media_id`/`video_url` — серверный контракт; клиентский TS-параметр `postMediaId`/`videoUrl` допустим как локальные аргументы функции, маппинг в snake_case при формировании body.)
- **Env-guards вне try/catch** (project-context #6): проверка `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` до основной логики.
- **service_role для записи** (project-context #4): upload thumbnail и update `thumbnail_url` идут под `service_role` (обход RLS) — выполняется внутри Edge Function, а не на клиенте.

### КЛЮЧЕВОЙ технический риск (читать перед реализацией)

**`ffmpeg.wasm` в `supabase/edge-runtime` — нетривиально.** Edge-runtime — ограниченный Deno-сэндбокс: может не быть `SharedArrayBuffer`/потоков, есть лимиты памяти и wall-clock/CPU на worker. Поэтому:
- **Библиотека НЕ предопределена — выбрать ДО кода (Subtask 1.0).** `@ffmpeg/ffmpeg` спроектирован под браузер (Web Worker + `SharedArrayBuffer`) и **в `supabase/edge-runtime` напрямую не работает** — выбор его «по умолчанию» = тупик. Перед Task 1.3 исследовать (context7/web) актуальную библиотеку извлечения одного кадра, **подтверждённо работающую в Deno/`supabase/edge-runtime` без `SharedArrayBuffer`/потоков** (кандидаты на проверку: single-thread core `@ffmpeg/core-st` через `npm:`/`esm.sh`, нативный Deno-binding ffmpeg, либо лёгкий wasm-декодер одного кадра). Критерий приёмки: на стенде извлекает кадр из `.mp4` и хотя бы одного экзотического (`.mov`/HEVC) файла.
- Использовать **single-threaded** путь (без `-pthread`/`SharedArrayBuffer`).
- Извлекать **ровно один кадр** (`-ss 0.1 -frames:v 1`), не декодировать всё видео.
- Тяжёлые/экзотические файлы (именно те, ради которых нужен fallback) могут упереться в лимиты — это ОЖИДАЕМО и покрыто **graceful degradation 8.1** (save без poster + `toast.warning`).
- Если на стенде выбранная библиотека нестабильна → активировать **escape hatch (Вариант C)**: вынести генерацию во внешний Node+ffmpeg-static сервис в `hetzner-deploy/`, сохранив тот же HTTP-контракт. Вызывающие (`serverThumbnail.ts`, route, 8.3) **не меняются**. Зафиксировать решение в Completion Notes, не блокировать story.

### Состояние изменяемых файлов (что есть сейчас → что меняем)

- **`src/app/api/admin/generate-thumbnail-fallback/route.ts`** (8.1, skeleton):
  - *Сейчас:* после полной валидации (auth 401 → admin 403 → JSON 400 → null/non-object 400 → missing fields 400 → SSRF-prefix `…/public/post_media/posts/` 400 → video-ext `.mp4/.mov/.webm` 400) возвращает `501 "not implemented yet"`.
  - *Меняем:* только финальный `501` → вызов `requestServerThumbnail` и `200 { thumbnail_url }`; ошибку движка → `502`/`500`. **Вся валидация остаётся дословно** (на ней завязаны 10 тестов).
- **`src/features/admin/api/postThumbnails.ts`** (8.1):
  - *Сейчас:* `runThumbnailTask` — для blob: `uploadThumbnail`+`updateThumbnailUrl` (persisted:true, orphan-cleanup при сбое); `else if thumbnail_status==='error'` → `requestThumbnailFallback(...)` (бросает при не-ok), но возвращает `persisted:false`. `requestThumbnailFallback` использует `AbortController`+`FALLBACK_FETCH_TIMEOUT_MS=2000`, комбинирует с external signal. `applyNewVideoThumbnails`: `expected = tasks.length`, бюджет `THUMBNAIL_PIPELINE_BUDGET_MS=2500`, `controller.abort()` по таймеру, `allPersisted = persisted >= expected`.
  - *Меняем:* при успешном fallback в пределах бюджета → `persisted:true`. Реализационно: либо `requestThumbnailFallback` зовёт `requestServerThumbnail` и возвращает успех, либо `runThumbnailTask` помечает persisted при отсутствии throw. **Не менять** бюджет, abort, only-on-error-условие, blob-ветку.
- **Тесты** `route.test.ts` (501-тест) и `postThumbnails.test.ts` (fallback-budget тест) — обновить под новый контракт (см. AC5).

### Контракты переиспользуемых утилит (НЕ дублировать)

- `getThumbnailStoragePath(id)` (`src/lib/media/uploadThumbnail.ts`) → `thumbnails/{id}_thumb.jpg`, bucket `post_media`. Edge Function должна строить **тот же** путь (через `_shared/buildThumbnailPath`, идентичный по результату).
- `updateThumbnailUrl` (`src/lib/media/updateThumbnailUrl.ts`): `.update({thumbnail_url}).eq('id', id).select('id')` + throw при 0 строк. Edge Function повторяет эту семантику серверно.
- Спецификация изображения из NFR8.2 и `generateVideoThumbnail.ts`: 640×360, JPEG q85, кадр при 0.1s, cover-crop без искажения, ≤150 KB.

### Безопасность

- Gateway `VERIFY_JWT=true` проверяет только **подпись** и пропускает **любой** валидный JWT (в т.ч. участника). Поэтому Edge Function **обязана** сама декодировать `Authorization: Bearer …` (верификация HS256 c `JWT_SECRET` из env контейнера), прочитать claim `role` и пропустить только `service_role` → иначе `403`. Без этого обычный пользователь смог бы дёргать функцию напрямую через `…/functions/v1/generate-thumbnail`.
- SSRF-allowlist повторяется на стороне Edge Function (defense-in-depth) — не доверять тому, что route уже проверил.
- `SUPABASE_SERVICE_ROLE_KEY` — серверный секрет, только на Vercel (server env) и внутри функции; **никогда** не уходит на клиент.
- Все `/api/admin/*` проверки admin (route) сохраняются.
- **Client/Server boundary (критично).** `serverThumbnail.ts` (с `service_role`) вызывается ТОЛЬКО на сервере. Цепочка:
  ```
  браузер postThumbnails.ts → fetch → /api/admin/generate-thumbnail-fallback (Vercel server)
                                          → serverThumbnail.ts (service_role) → Edge Function
  ```
  Браузер НИКОГДА не зовёт Edge Function напрямую (нет и не должно быть `service_role` на клиенте). `serverThumbnail.ts` помечается `import 'server-only'`.

### Save-time vs standalone/bulk — разные бюджеты

- **Save-time fallback (8.1):** жёстко ограничен 2500 мс (чтобы не блокировать публикацию). Server-генерация тяжёлого видео обычно **не успеет** → задача прерывается `AbortController`, graceful degradation. Это by design, не баг. Edge Function **идемпотентна** (`upsert`): прерванный/повторный вызов не оставляет битого состояния и безопасно перезаписывается следующей попыткой (8.2/8.3/8.4).
- **Standalone fallback-роут и 8.3 bulk:** НЕ связаны бюджетом сохранения — вызывающий даёт больший таймаут. Задать его явно через константу/env `SERVER_THUMBNAIL_TIMEOUT_MS` (рекомендация ~25–30 с), чтобы 8.3 не угадывал. **Важно:** Vercel-route по умолчанию обрывается на 10 с — для standalone/bulk-пути добавить `export const maxDuration = …` в соответствующий route (иначе платформа убьёт медленную генерацию до завершения). Контракт один и тот же; отличается только таймаут вызова на стороне клиента.

### UI / Slovenian Language

- Новых пользовательских строк не требуется. С реальным fallback теперь по-настоящему срабатывает путь `toast.success` («Poster je bil ustvarjen») для видео, восстановленных сервером в пределах бюджета; вне бюджета — существующий `POSTER_NOT_GENERATED_MESSAGE` («Poster ni bil samodejno ustvarjen…»).

### Testing Notes

- Раннер проекта — **Vitest** (`tests/unit/**`). Паттерны моков — см. CLAUDE.md (Supabase server/client, `next/navigation`).
- `route.test.ts`: мокировать `@/lib/media/serverThumbnail` (или global `fetch`) для успех/ошибка; сохранить мок `@/lib/supabase/server` (auth/profiles) как сейчас.
- `serverThumbnail.test.ts`: мок global `fetch`; `vi.stubEnv` для URL/ключа.
- Edge Function `_shared/*` — **выбрать стратегию явно** (не вводить новый раннер втихую): либо `deno test` строго в области `supabase/functions/` (тогда добавить npm-скрипт `test:functions` и не подключать к Vitest-CI), либо держать хелперы как чистый TS без Deno-специфики и покрыть их в Vitest. Обязателен инвариант-тест `buildThumbnailPath(id) === getThumbnailStoragePath(id)` (защита от рассинхрона пути thumbnail). Реальное извлечение кадра — ручная/интеграционная проверка на стенде (Subtask 6.2).

### Project Structure Notes

- Edge Function-источник: `supabase/functions/generate-thumbnail/` + `supabase/functions/main/` + `supabase/functions/_shared/` (новая ветка дерева — раньше в `supabase/` были только `migrations/`). Деплой-копия — `hetzner-deploy/volumes/functions/` (монтируется в контейнер).
- Тонкий клиент — `src/lib/media/serverThumbnail.ts` (рядом с `uploadThumbnail.ts`/`updateThumbnailUrl.ts`/`generateVideoThumbnail.ts`).
- Никаких изменений в `src/components/ui/` (правило: `ui/` не импортирует `features/`).

### Scope boundaries (явно ВНЕ этой story)

- **8.3** ретроактивный bulk (только *потребляет* контракт; параллелизм/отчёт/resume — там).
- **8.2** ручная загрузка poster, **8.4** regenerate/delete.
- AI/«лучший кадр», динамическая генерация из внешних URL.

### References

- [Source: _bmad-output/implementation-artifacts/8-1-automatic-thumbnail-generation-on-save.md#Отложенный scope] — skeleton 501, контракт, `ThumbnailPipelineResult`, graceful degradation
- [Source: _bmad-output/implementation-artifacts/8-3-retroactive-thumbnail-generation.md#Task 4] — потребитель того же движка (bulk)
- [Source: _bmad-output/planning-artifacts/prd-video-thumbnails.md#FR8.1] / #NFR8.1 / #NFR8.2 / #NFR8.5
- [Source: _bmad-output/planning-artifacts/prd-video-thumbnails.md#Опция B: Server-side fallback + bulk] — решение Open Question #1 (Edge Function)
- [Source: _bmad-output/planning-artifacts/architecture.md#Storage Bucket Architecture]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules] — service_role, env-guard, snake_case
- [Source: hetzner-deploy/docker-compose.official.yml:437-466] — сервис `functions`, env, `--main-service`, `VERIFY_JWT`
- [Source: hetzner-deploy/env.example:6-7,118] — `JWT_SECRET`, `SERVICE_ROLE_KEY`, `FUNCTIONS_VERIFY_JWT`
- [Source: src/app/api/admin/generate-thumbnail-fallback/route.ts] — текущий skeleton + валидация
- [Source: src/features/admin/api/postThumbnails.ts] — save-time pipeline, бюджет/abort
- [Source: src/lib/media/uploadThumbnail.ts] / updateThumbnailUrl.ts / generateVideoThumbnail.ts — контракты и спецификация изображения

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
