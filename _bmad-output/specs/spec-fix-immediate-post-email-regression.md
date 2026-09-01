---
title: 'Fix: тихий провал email-рассылки при немедленной публикации (отсутствовали Vercel env → сбой проглатывался клиентом)'
type: 'bugfix'
created: '2026-06-12'
status: 'done'
baseline_commit: '90def2ad'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Сегодня (12 июня) отложенный (`scheduled`) пост опубликовали «Objavi zdaj» → `/api/posts/publish` опубликовал пост, но email-уведомления не ушли (в Resend ноль). _(Пост был именно `scheduled`, а не `draft`: `/api/posts/publish` требует `status==='scheduled'` (route.ts:70), а `isImmediatePublish` в `PostForm` истинно только для scheduled — будь это draft, путь рассылки вообще не вызвался бы и пост остался бы черновиком; раз он опубликован — ветка scheduled→publish-now.)_ Прод-диагностика: в Vercel Production отсутствовали `NOTIFICATION_API_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` → `sendNewPostNotification` бросал на env-guard ещё до загрузки подписчиков. `/api/posts/publish` ловил это и возвращал **HTTP 200** с полем `emailError`, а клиент `PostForm` проверял только `response.ok` → ошибка **молча проглатывалась**, админ видел «опубликовано». Эта невидимость — причина, по которой баг пережил прошлые «фиксы».

**Approach:** Инфра-корень устранён пользователем (переменные добавлены в Vercel; нужен Redeploy + верификация доставки). Код-фикс убирает **тихое проглатывание**: `PostForm` после успешного `/api/posts/publish` читает `emailError` из тела ответа и, если он есть, показывает админу предупреждающий toast (публикация при этом НЕ откатывается — пост опубликован). Так любой будущий сбой рассылки (нет env, ошибка Resend) перестаёт быть невидимым.

## Boundaries & Constraints

**Always:** Публикация поста НЕ откатывается при провале рассылки (текущее поведение сохраняется). Провал рассылки ОБЯЗАН быть виден админу — toast.warning, а не молчание. UI-строки на словенском. snake_case для полей БД. Route `/api/posts/publish` сохраняет семантику ответа (200 при опубликованном посте даже с `emailError` — чтобы публикация не воспринималась как неуспех). Системные ошибки → Toast (Sonner), не inline. Значение `NOTIFICATION_API_SECRET` в Vercel должно совпадать с использовавшимся ранее (`.env.local`) — иначе HMAC-подпись изменится и ранее разосланные unsubscribe-ссылки протухнут.

**Ask First:** Фикс смежных латентных багов (createPost для нового поста не вызывает рассылку; updatePost для черновик→published не выставляет статус и не шлёт письмо) — вынесены в deferred-work, это отдельные deliverable. Настройка Supabase DB Webhook или перевод `/api/notifications/new-post` в публичные префиксы. Изменение HTTP-кодов ответа route.

**Never:** Не менять логику формирования писем, шаблон, фильтр подписчиков, HMAC-подпись unsubscribe. Не ослаблять авторизацию. НЕ добавлять `/api/notifications/` в `PUBLIC_PATH_PREFIXES`. Не менять `partial-fail → 200` в route'ах (защита от ретраев Supabase webhook). Не трогать cron-расписание. Не откатывать публикацию при ошибке рассылки.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Публикация, рассылка OK | 200 `{published:true, emailError:null, emailFailed:0}` | success-toast «опубликовано», переход на `/feed` | N/A |
| Hard-ошибка рассылки | 200 `{published:true, emailError:'...', emailFailed:0}` (нет env / ошибка БД) | пост опубликован; **warning-toast** «опубликовано, но уведомления не отправлены»; переход на `/feed` | видно админу, публикация не откатывается |
| Partial-fail рассылки | 200 `{published:true, emailError:null, emailFailed:N>0}` (Resend отверг чанк) | то же **warning-toast**; переход на `/feed` | видно админу (не теряется, хотя throw не было) |
| 0 подписчиков | 200 `{published:true, emailError:null, emailFailed:0}` | success-toast (рассылать некому — это норма, не сбой) | N/A |
| Сама публикация упала | `/api/posts/publish` → non-200 `{error}` | error-toast с текстом; перехода НЕТ (без изменений) | throw из ветки |
| Нет Vercel env (корень) | `NOTIFICATION_API_SECRET`/`RESEND_*` отсутствуют | `sendNewPostNotification` throw на guard → route `emailError` → warning-toast | устраняется добавлением env + Redeploy (infra) |

</frozen-after-approval>

## Code Map

- `src/features/admin/components/PostForm.tsx:312-329` -- ветка immediate-publish в edit-режиме: сейчас читает тело только при `!response.ok`; добавить чтение `emailError`/`emailFailed` при 200 и warning-toast
- `src/features/admin/components/ScheduledPostsContainer.tsx:36-58` -- **второй потребитель** `/api/posts/publish` («Objavi zdaj» в таблице): `handlePublishNow` читает тело только при `!res.ok` → тот же surfacing на 200 (warning при `emailError || emailFailed>0`; строку не возвращаем — пост опубликован)
- `src/app/api/posts/publish/route.ts:97-106` -- захватить `{ sent, failed }` из `sendNewPostNotification` и добавить `emailFailed` в 200-ответ (сейчас результат не используется → partial-fail `failed>0` без throw возвращает `emailError:null` и теряется молча)
- `src/components/ui/sonner.tsx` (или layout) -- проверить, поддерживает ли проектный Sonner `toast.warning`; если нет — fallback `toast.error`/`toast('...', { icon })`
- `src/lib/notifications/sendNewPostNotification.ts:101-112` -- env-guard (NOTIFICATION_API_SECRET → throw первым); объясняет корень (НЕ меняем)
- `src/lib/email/index.ts:5-13,36-39` -- guard'ы RESEND_API_KEY / RESEND_FROM_EMAIL (НЕ меняем; контекст)
- `src/app/api/cron/publish/route.ts:80-91` -- cron уже логирует `emailErrors` (видимость через логи; вне scope)
- `tests/unit/features/admin/components/PostForm.test.tsx` -- добавить кейсы emailError → warning / no-warning
- `tests/unit/features/admin/components/ScheduledPostsContainer.test.tsx` -- кейсы surfacing для `handlePublishNow`
- `tests/unit/app/api/posts/publish/route.test.ts` -- patch: кейс проброса `emailFailed` при partial-fail

## Tasks & Acceptance

**Execution — код:**
- [x] `src/app/api/posts/publish/route.ts` -- захватить результат `const { failed } = await sendNewPostNotification(...)`; в успешном ответе вернуть `{ published: true, emailError, emailFailed: failed }` (при throw `emailFailed: 0`). Семантику 200/partial-fail не меняем — только добавляем поле, чтобы `failed>0` перестал теряться молча.
- [x] `src/features/admin/components/PostForm.tsx` -- в ветке `isImmediatePublish` (edit) распарсить тело один раз: при `!response.ok` → throw с `data.error` (как сейчас); при 200, если `data.emailError` непустой **ИЛИ** `data.emailFailed > 0` → `toast.warning('Objava je bila objavljena, vendar e-poštna obvestila niso bila poslana.')` и продолжить (переход на `/feed`); иначе существующий success-toast. Не добавлять `useState` для этой системной ошибки. **Перед использованием `toast.warning` убедиться, что проектный Sonner его поддерживает (`src/components/ui/sonner.tsx`); если нет — `toast.error` с тем же текстом.**
- [x] `tests/unit/features/admin/components/PostForm.test.tsx` -- кейсы: (1) 200 `{emailError:'...', emailFailed:0}` → warning, навигация на `/feed`; (2) 200 `{emailError:null, emailFailed:2}` → warning, навигация; (3) 200 `{emailError:null, emailFailed:0}` → `toast.success`, warning НЕ вызван; (4) regression: non-200 → `toast.error`, перехода нет.
- [x] `src/features/admin/components/ScheduledPostsContainer.tsx` -- в `handlePublishNow` распарсить тело один раз: при `!res.ok` → throw (как сейчас); при 200, если `body.emailError` непустой **ИЛИ** `(body.emailFailed ?? 0) > 0` → `toast.warning('Objava je bila objavljena, vendar e-poštna obvestila niso bila poslana.')`. Строку НЕ возвращаем (пост опубликован). На чистой доставке поведение прежнее (строка удалена, без toast). Проверить, что мок `sonner` в тесте включает `warning`.
- [x] `tests/unit/features/admin/components/ScheduledPostsContainer.test.tsx` -- кейсы: (1) 200 `{emailError:'...'}` → `toast.warning`, строка удалена (не возвращается); (2) 200 `{emailFailed:3}` → `toast.warning`; (3) 200 `{}` (чистая доставка) → ни warning, ни error, строка удалена; (4) regression: non-200 → `toast.error`, строка возвращается.
- [x] `tests/unit/app/api/posts/publish/route.test.ts` -- patch: при `sendNewPostNotification` resolve `{ sent: 0, failed: 3 }` → 200, `body.emailFailed === 3`, `body.emailError === null`.

**Execution — инфраструктура (корень, вне кода) — частично выполнено пользователем 2026-06-12:**
- [x] Добавить в Vercel Production отсутствовавшие env: `NOTIFICATION_API_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (а также `COOKIE_SECRET`, `SUBSCRIPTION_CACHE_TTL_SECONDS`, `STRIPE_WEBHOOK_RATE_LIMIT_*`).
- [ ] **Redeploy** Production (env применяются только в новом деплое) и провести верификацию доставки (см. Verification).

**Acceptance Criteria:**
- **AC1 (видимость сбоя — hard и partial):** Given немедленная публикация, когда `/api/posts/publish` вернул 200 с непустым `emailError` **или** `emailFailed > 0`, then админ видит warning-toast о том, что уведомления не отправлены, и пост остаётся опубликованным (переход на `/feed` выполняется).
- **AC2 (успех без шума):** Given 200 с `emailError == null` И `emailFailed === 0` (включая случай 0 подписчиков), then показывается только success-toast, warning НЕ показывается.
- **AC2b (route контракт):** Given `/api/posts/publish` отработал, then тело ответа содержит `emailFailed: <число>` (= `failed` из `sendNewPostNotification`, или `0` при throw), при этом код ответа и `partial-fail → 200` не изменены.
- **AC3 (regression публикации):** Given `/api/posts/publish` вернул non-200, then показывается error-toast и перехода на `/feed` нет (поведение без изменений).
- **AC4 (доставка восстановлена + дискриминация второго корня) — ⚠️ проверяется вручную на проде:** Given Vercel Production содержит `NOTIFICATION_API_SECRET` + `RESEND_API_KEY` + `RESEND_FROM_EMAIL` и выполнен Redeploy, when отложенный пост публикуется «Objavi zdaj», then в Vercel-логах строка `[notifications] Sent N/M` и в Resend появляется попытка. Если вместо неё `[publish] Email failed ...: [notifications] Failed to fetch subscribers` — активен **второй корень** (устаревший `SUPABASE_SERVICE_ROLE_KEY`, корень C прошлой спеки), спека НЕ закрыта до его устранения. То есть отсутствие env — основная, но не доказанно-единственная причина: подтверждаем по реальной строке лога, а не по предположению.

## Spec Change Log

- **2026-06-12 — review loopback (bad_spec, specLoopIteration 2).** Триггер: edge-case-hunter обнаружил **второго живого потребителя** `/api/posts/publish` — `ScheduledPostsContainer.handlePublishNow` (`src/features/admin/components/ScheduledPostsContainer.tsx:42`), действие «Objavi zdaj» в таблице отложенных постов. Он проверял только `!res.ok` и проглатывал `emailError`/`emailFailed` — тихий сбой сохранялся на этом входе (вероятно, именно им публиковали сегодня). Спека покрывала только `PostForm` → цель «сделать сбой видимым при немедленной публикации» достигалась наполовину. Амендмент: в Code Map/Tasks/Verification добавлен `ScheduledPostsContainer` (тот же surfacing: warning при `emailError || emailFailed>0`; строка опубликована — откат строки НЕ делаем) и route-тест на проброс `emailFailed` при partial-fail. Избегаемое известно-плохое состояние: один UI-вход предупреждает, другой молчит → баг повторяется через таблицу. **KEEP (подтверждено ревью):** `route.ts` → `{ published, emailError, emailFailed }` (захват `result.failed`, при throw `emailFailed:0`); `PostForm` — warning при `emailError||emailFailed>0`, навигация не блокируется, success только при чистой доставке; их 4 unit-кейса. Контракт `sendNewPostNotification` ({sent,failed}; 0 подписчиков → {0,0}) — без изменений. Отклонено как шум: «result.failed может быть undefined» (контракт всегда возвращает объект).

## Design Notes

**Почему фикс — видимость, а не «добавить env в код».** Инфра-корень (нет env) пользователь уже устранил; повторять это в коде нечем. Истинный код-дефект — `/api/posts/publish` намеренно возвращает 200 при опубликованном посте даже с провалом рассылки (это правильно — публикация состоялась), но клиент игнорирует `emailError`. Из-за этого любой провал рассылки (нет env, Resend down, 0 подписчиков → тут `emailError == null`, это норма) выглядел как полный успех. Surfacing `emailError` делает класс «config-провал рассылки» наблюдаемым на будущее и закрывает причину, по которой баг переживал прошлые фиксы. Cron-ветку не трогаем в этой спеке, но честно: её «видимость» (`console.error` + `emailErrors` в 200-ответе → `net._http_response`) на практике никто не мониторит рутинно — для scheduled-постов сбой рассылки остаётся таким же молчаливым. Это та же проблема, что уже зафиксирована в `deferred-work.md` («HTTP 200 при отсутствующих env vars», review 6-2) — кандидат на `notification_log`/health-check-алертинг, вынесен в deferred, не расширяю scope.

## Verification

**Commands:**
- `npm run test -- tests/unit/features/admin/components/PostForm.test.tsx tests/unit/features/admin/components/ScheduledPostsContainer.test.tsx tests/unit/app/api/posts/publish/route.test.ts` -- expected: новые кейсы surfacing (PostForm + ScheduledPostsContainer) и проброс emailFailed (route) зелёные
- `npm run typecheck` -- expected: 0 ошибок
- `npm run lint` -- expected: без новых предупреждений

**Manual checks (корень — infra):**
- Vercel → Settings → Environment Variables (Production): присутствуют `NOTIFICATION_API_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
- Выполнить **Redeploy** Production (без него новые env не подхватятся).
- Опубликовать тестовый отложенный пост «Objavi zdaj» → в Resend Dashboard появляется попытка; в Vercel Runtime Logs строка `[notifications] Sent N/M`, НЕ `[publish] Email failed`.

## Suggested Review Order

**Контракт ответа (источник сигнала)**

- Точка входа: route захватывает `failed` и пробрасывает `emailFailed` — без него partial-fail терялся молча.
  [`route.ts:104`](../../src/app/api/posts/publish/route.ts#L104)

**Surfacing на обоих UI-входах (ядро фикса)**

- Вход №1 — редактор: warning при `emailError || emailFailed>0`, публикация не откатывается, навигация сохраняется.
  [`PostForm.tsx:330`](../../src/features/admin/components/PostForm.tsx#L330)

- Вход №2 — таблица отложенных «Objavi zdaj»: тот же surfacing, строка остаётся удалённой (пост опубликован).
  [`ScheduledPostsContainer.tsx:47`](../../src/features/admin/components/ScheduledPostsContainer.tsx#L47)

**Тесты (поддержка)**

- Клиент №1: warning (hard/partial), success без шума, regression non-200.
  [`PostForm.test.tsx:875`](../../tests/unit/features/admin/components/PostForm.test.tsx#L875)

- Клиент №2: warning (hard/partial), чистая доставка без toast, regression rollback.
  [`ScheduledPostsContainer.test.tsx:99`](../../tests/unit/features/admin/components/ScheduledPostsContainer.test.tsx#L99)

- Route: проброс `emailFailed` при partial-fail без throw.
  [`route.test.ts:150`](../../tests/unit/app/api/posts/publish/route.test.ts#L150)
