---
title: 'Fix: рассылка не уходит при создании нового поста и при переводе черновика в published'
type: 'bugfix'
created: '2026-06-15'
status: 'done'
baseline_commit: '41b93da8'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** При создании НОВОГО поста сразу как «опубликовано» (`createPost`, ветка `else` в `PostForm.onSubmit:345-355`) email-рассылка `sendNewPostNotification` не вызывается вообще — подписчики не получают письмо. Рассылка сегодня триггерится только для `scheduled → published` (через `/api/posts/publish`) и из cron. Смежный класс той же дыры: редактирование `draft → published` тоже не шлёт письмо, и более того — `updatePost` в ветке `published` не выставляет `status/is_published/published_at`, поэтому черновик остаётся `draft` в БД (зафиксировано в `deferred-work.md`).

**Approach:** После успешного сохранения нового published-поста и после `draft → published` клиент `PostForm` напрямую вызывает существующий `POST /api/notifications/new-post` (admin-session auth уже работает) с `{ id, title, excerpt }`, и surface'ит результат как в edit-ветке: чистая доставка → success-toast, любой сбой рассылки → warning-toast БЕЗ отката создания/публикации (пост уже сохранён). Дополнительно чиним `updatePost`, чтобы переход `draft → published` корректно выставлял published-поля.

## Boundaries & Constraints

**Always:** Создание/публикация поста НЕ откатывается при провале рассылки. Провал рассылки ОБЯЗАН быть виден админу (`toast.warning`, не молчание). Рассылка вызывается ТОЛЬКО когда пост реально становится `published` (новый published-пост; `draft → published`). UI-строки на словенском. snake_case для полей БД. Системные ошибки → Toast (Sonner), не inline. Переиспользовать существующий route `/api/notifications/new-post` и функцию `sendNewPostNotification` как есть.

**Ask First:** Изменение схемы авторизации или контракта ответа route `/api/notifications/new-post`. Перенос `createPost` на сервер / новый route публикации. Добавление `notification_log` / health-check-алертинга.

**Never:** Не дублировать рассылку для `scheduled → published` — этот путь остаётся на `/api/posts/publish` (его НЕ трогаем). Не слать письмо при обычном редактировании уже опубликованного поста (`published → published`). Не менять логику формирования писем, шаблон, фильтр подписчиков, HMAC-подпись unsubscribe. Не менять контракт/коды ответа `/api/notifications/new-post` и `/api/posts/publish`. Не ослаблять авторизацию. Не добавлять `/api/notifications/` в `PUBLIC_PATH_PREFIXES`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Новый published-пост, рассылка OK | create, `status='published'`, route 200 `{sent:N,failed:0}` | пост создан; success-toast; переход на `/feed` | N/A |
| Новый scheduled-пост | create, `status='scheduled'` | пост создан как `scheduled`; рассылка НЕ вызывается; success-toast | N/A |
| draft → published, рассылка OK | edit, `initialData.status='draft'` → `published`; `updatePost` выставил published-поля; route 200 `{failed:0}` | пост `published` в БД; success-toast; переход на `/feed` | N/A |
| Сбой рассылки (hard, route 500) | пост уже создан/опубликован; `POST /api/notifications/new-post` → 500 `{error}` | warning-toast «opublikovano, obvestila niso poslana»; переход на `/feed` (создание НЕ откатывается) | видно админу, без throw |
| Partial-fail рассылки | route 200 `{sent,failed:N>0}` | то же warning-toast; переход на `/feed` | видно админу |
| 0 подписчиков | route 200 `{sent:0,failed:0}` | success-toast (рассылать некому — норма) | N/A |
| scheduled → published | edit, `initialData.status='scheduled'` → `published` | путь `/api/posts/publish` БЕЗ изменений; `updatePost` НЕ выставляет published-поля (оставляет scheduled для publish-route) | без изменений |
| Само создание упало | `createPost` бросает | error-toast; рассылка НЕ вызывается; перехода нет | throw |

</frozen-after-approval>

## Code Map

- `src/features/admin/components/PostForm.tsx:345-355` -- ветка create: после `createPost` (возвращает `postId`), если `meta.status === 'published'` → вызвать рассылку + surface
- `src/features/admin/components/PostForm.tsx:297-344` -- ветка edit: добавить `isDraftPublish = initialData.status === 'draft' && parsed.data.status === 'published'` → после `updatePost` вызвать рассылку + surface; `scheduled → published` остаётся на `/api/posts/publish`
- `src/features/admin/api/posts.ts:258-296` -- `updatePost`: добавить ветку `meta.status === 'published' && snapshot?.status === 'draft'` → выставить `status='published'`, `is_published=true`, `published_at=getPublishedTimestamp()`; НЕ трогать переходы из `scheduled`/`published`
- `src/app/api/notifications/new-post/route.ts` -- потребляемый route (200 `{sent,failed}` / 500 `{error}`); admin-session auth. НЕ меняем
- `src/lib/notifications/sendNewPostNotification.ts` -- чистая функция рассылки (контекст контракта `{sent,failed}`). НЕ меняем
- `src/features/admin/components/ScheduledPostsContainer.tsx` -- референс surface-паттерна. НЕ трогаем
- `tests/unit/features/admin/components/PostForm.test.tsx:206+,577+,875+` -- create/edit/surfacing describe-блоки + мок `global.fetch`
- `tests/unit/features/admin/api/posts.test.ts` -- тесты `updatePost` (если есть; иначе создать кейс draft→published)

## Tasks & Acceptance

**Execution — код:**
- [x] `src/features/admin/api/posts.ts` -- в `updatePost`: добавить ветку `else if (meta.status === 'published' && snapshot?.status === 'draft')` → `updatePayload.status='published'`, `updatePayload.is_published=true`, `updatePayload.published_at=getPublishedTimestamp()`. Не менять поведение при `snapshot.status === 'scheduled'` (остаётся для `/api/posts/publish`) и при `snapshot.status === 'published'` (обычный update, без published_at/рассылки). Rollback-снэпшот уже включает эти поля.
- [x] `src/features/admin/components/PostForm.tsx` -- ввести единый внутренний helper `notifyNewPost(post: { id; title; excerpt })`: `POST /api/notifications/new-post` с телом `{ id, title, excerpt }`; распарсить ответ один раз; вернуть `notificationFailed = !response.ok || (data.failed ?? 0) > 0`. **НЕ бросать** при `!response.ok` (пост уже сохранён). В create-ветке: после `createPost` (id) при `meta.status === 'published'` вызвать helper и показать `toast.warning('Objava je bila objavljena, vendar e-poštna obvestila niso bila poslana.')` при `notificationFailed`, иначе существующий success. В edit-ветке: при `isDraftPublish` вызвать helper и тот же surface; `scheduled → published` (`isImmediatePublish`) оставить на `/api/posts/publish` без изменений. Навигация на `/feed` сохраняется во всех success/warning случаях.
- [x] `tests/unit/features/admin/components/PostForm.test.tsx` -- create-кейсы: (1) `status='published'` + route 200 `{failed:0}` → `fetch('/api/notifications/new-post')` вызван, `toast.success`; (2) route 500 → `toast.warning`, навигация на `/feed`; (3) route 200 `{failed:2}` → `toast.warning`; (4) `status='scheduled'` → рассылка НЕ вызвана, success. Edit-кейсы: (5) `draft → published` → рассылка вызвана + surface; (6) regression `scheduled → published` → идёт на `/api/posts/publish` (не на notifications); (7) regression `published → published` (обычный edit) → рассылка НЕ вызвана.
- [x] `tests/unit/features/admin/api/posts.test.ts` -- `updatePost` кейсы: `draft → published` выставляет `status/is_published/published_at`; `scheduled → published` НЕ выставляет (остаётся scheduled); `published → published` не трогает `published_at`.

**Acceptance Criteria:**
- **AC1 (новый published-пост):** Given создание поста в режиме «Objavi zdaj», when пост создан, then `POST /api/notifications/new-post` вызывается с `{ id, title, excerpt }` и письма уходят подписчикам; провал рассылки НЕ откатывает создание.
- **AC2 (draft → published):** Given редактирование черновика в режиме «Objavi zdaj», when сохранено, then пост в БД имеет `status='published'`/`is_published=true`/`published_at!=null` И вызвана рассылка.
- **AC3 (видимость сбоя):** Given рассылка вернула 500 `{error}` ИЛИ 200 `{failed>0}`, then админ видит warning-toast и пост остаётся сохранённым (переход на `/feed`).
- **AC4 (no double-send / no false-send):** Given `scheduled → published`, then рассылка идёт ТОЛЬКО через `/api/posts/publish` (не через notifications); Given `published → published`, then рассылка НЕ вызывается.
- **AC5 (success без шума):** Given чистая доставка (`failed:0`, в т.ч. 0 подписчиков), then только success-toast, warning НЕ показывается.

## Spec Change Log

- **2026-06-15 — review (specLoopIteration 1, no loopback).** Три ревьюера (blind / edge-case / acceptance). Acceptance: все AC1–AC5 и Constraints выполнены. **Patch применён** (TOCTOU-кластер blind #1/#2 + edge #1/#2): рассылка для `draft → published` решалась на клиенте по устаревшему `initialData.status`, тогда как `updatePost` публикует по свежему серверному snapshot — при гонке возможна ложная/повторная рассылка. Фикс: `updatePost` возвращает `{ published: boolean }` (факт реального перехода по snapshot), `PostForm` триггерит `notifyNewPost` строго по этому флагу (`didPublish`), а не по `initialData.status`. Добавлен тест «does NOT notify when updatePost reports no publish (stale draft / race)». **Defer:** scheduled→published two-write split fragility (pre-existing) → `deferred-work.md`. **Reject:** notify без Bearer (консистентно с `/api/posts/publish` cookie-auth), malformed-200 как clean, network-error без retry, email title из meta, await блокирует навигацию, createPost published_at=null при сбое отдельного update (pre-existing).

## Design Notes

**Почему `!response.ok` рассылки ≠ throw (отличие от edit-ветки).** В существующей ветке `scheduled → published` клиент бросает при `!response.ok`, потому что там `/api/posts/publish` отвечает non-200 = публикация не удалась. Здесь пост уже создан/опубликован ДО вызова рассылки, поэтому 500 от `/api/notifications/new-post` означает лишь «рассылка не ушла» — это warning, а не ошибка операции. Контракт ответа route отличается от publish: `{ sent, failed }` (200) / `{ error }` (500), без полей `emailError`/`emailFailed` — surface строим на `!response.ok || (data.failed ?? 0) > 0`.

**Почему `updatePost` чинит только `draft → published`.** Ветка `scheduled → published` намеренно НЕ выставляет published-поля в `updatePost`: пост должен остаться `scheduled`, чтобы `/api/posts/publish` (требует `status==='scheduled'`) подхватил его и опубликовал. Выставление published сломало бы этот путь. Поэтому guard — строго `snapshot?.status === 'draft'`.

## Verification

**Commands:**
- `npm run test -- tests/unit/features/admin/components/PostForm.test.tsx tests/unit/features/admin/api/posts.test.ts` -- expected: новые create/edit/surfacing/updatePost кейсы зелёные
- `npm run typecheck` -- expected: 0 ошибок
- `npm run lint` -- expected: без новых предупреждений
- `npm run build` -- expected: успешная сборка

**Manual checks:**
- Создать новый пост «Objavi zdaj» → в Resend Dashboard появляется попытка; в логах `[notifications] Sent N/M`.
- Создать черновик, затем открыть его в редакторе и «Objavi zdaj» → пост виден в `/feed` как published, в Resend — попытка.
- Запланировать пост, затем «Objavi zdaj» из таблицы → рассылка идёт через `/api/posts/publish` (поведение без регресса).

## Suggested Review Order

**Источник истины перехода в published (ядро фикса)**

- Сервер выставляет published-поля и фиксирует факт перехода по свежему snapshot.
  [`posts.ts:289`](../../src/features/admin/api/posts.ts#L289)

- Возврат `{ published }` — единственный источник истины для рассылки (исключает TOCTOU).
  [`posts.ts:390`](../../src/features/admin/api/posts.ts#L390)

**Доставка рассылки и surfacing**

- Helper рассылки: пост уже сохранён → `!response.ok` это warning, не throw.
  [`PostForm.tsx:264`](../../src/features/admin/components/PostForm.tsx#L264)

- Новый published-пост: рассылка только при `meta.status === 'published'`.
  [`PostForm.tsx:392`](../../src/features/admin/components/PostForm.tsx#L392)

- Edit draft→published: рассылка по фактическому `didPublish`, а не `initialData.status`.
  [`PostForm.tsx:355`](../../src/features/admin/components/PostForm.tsx#L355)

**Тесты (поддержка)**

- Новый published-пост шлёт рассылку, чистая доставка → success.
  [`PostForm.test.tsx:1026`](../../tests/unit/features/admin/components/PostForm.test.tsx#L1026)

- TOCTOU-страж: `updatePost` вернул `published:false` → рассылки нет.
  [`PostForm.test.tsx:1142`](../../tests/unit/features/admin/components/PostForm.test.tsx#L1142)

- `updatePost` draft→published выставляет поля и возвращает `{ published: true }`.
  [`posts.test.ts:624`](../../tests/unit/features/admin/api/posts.test.ts#L624)
