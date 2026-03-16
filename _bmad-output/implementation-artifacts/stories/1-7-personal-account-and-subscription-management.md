# Story 1.7: Личный кабинет и управление подпиской

Status: in-progress

## Story

As a участница,
I want иметь возможность зайти в настройки и просмотреть/отменить свою подписку,
so that полностью контролировать свои платежи.

## Acceptance Criteria

1. **Given** авторизованная участница
   **When** она открывает раздел профиля
   **Then** отображается текущий статус её подписки
   **And** присутствует кнопка перехода в Stripe Customer Portal для управления биллингом

2. **Given** участница нажимает кнопку управления подпиской
   **When** отправляется запрос к серверу
   **Then** создается Stripe Customer Portal сессия
   **And** участница перенаправляется на безопасную страницу Stripe Customer Portal

3. **Given** участница находится в Stripe Customer Portal
   **When** она нажимает кнопку возврата
   **Then** она возвращается обратно на страницу профиля в приложении

## Tasks / Subtasks

- [x] **Review Follow-ups (AI) - Round 7**
  - [x] [AI-Review][Critical] Open Redirect bypass через `startsWith`: `clientReturnUrl.startsWith(requestOrigin)` пропускает URL вида `https://procontent.ru.evil.com/profile` — они начинаются с origin приложения, но указывают на чужой домен. Заменить на `new URL(clientReturnUrl).origin === requestOrigin` (обернуть в try/catch). Добавить тест на subdomain-spoofing кейс [src/app/api/stripe/portal/route.ts:58]
  - [x] [AI-Review][Medium] Хранилище растёт неограниченно при активных пользователях: прунинг триггерится только при `!entry` (новый пользователь), если 100 активных пользователей с не-истёкшими записями делают запросы — `pruneExpired` не вызывается никогда, store растёт бесконечно [src/lib/stripe/portal-rate-limit.ts:39]
  - [x] [AI-Review][Medium] Отсутствует заголовок `Retry-After` в ответе 429: добавить `headers: { 'Retry-After': '60' }` в NextResponse — клиент не знает через сколько секунд повторить запрос [src/app/api/stripe/portal/route.ts:22-25]
  - [x] [AI-Review][Medium] Тест `unpaid` статуса отсутствует в SubscriptionCard: `getStatusLabel` обрабатывает `'unpaid'` → `'Не оплачена'`, но тест не написан — задача 4.1 не закрыта полностью [tests/unit/features/profile/components/SubscriptionCard.test.tsx]
  - [x] [AI-Review][Low] Off-by-one в `pruneExpired`: `if (checked++ > 100) break` проверяет 101 элемент, комментарий гласит "до 100 элементов" — исправить на `>= 100` [src/lib/stripe/portal-rate-limit.ts:22]
  - [x] [AI-Review][Low] Test-only функции без `NODE_ENV` guard попадают в production bundle: `resetPortalRateLimitStore` и `getPortalRateLimitStoreSize` [src/lib/stripe/portal-rate-limit.ts:54-61]
  - [x] [AI-Review][Low] `ProfileScreen.tsx` не имеет собственных тестов: ветка `{displayName && ...}` не покрыта ни одним тестом [src/features/profile/components/ProfileScreen.tsx:26]
  - [x] [AI-Review][Low] `loading.tsx` не имеет тестов [src/app/(app)/profile/loading.tsx]

- [x] **Review Follow-ups (AI) - Round 8**
  - [x] [AI-Review][High] Memory Leak в Rate Limiter из-за особенностей итерации Map: `pruneExpired` проверяет до 100 записей и прерывает цикл. Так как Map итерируется в порядке добавления, если первые 100 пользователей постоянно обновляют лимиты, они остаются в начале очереди и функция никогда не дойдет до 101-й записи, которая могла устареть. Это приведет к бесконечному росту памяти. Исправить: при обновлении `resetAt` делать `delete` + `set` чтобы переместить ключ в конец Map, а при прунинге удалять записи с начала пока не встретится первая активная [src/lib/stripe/portal-rate-limit.ts:22]
  - [x] [AI-Review][Medium] Сломанный UX при ошибке БД: При `profileError` в `page.tsx` возвращается пустой `<main>` только с текстом ошибки. Теряется заголовок "Профиль" и структура страницы. Отрисовать ошибку консистентно с дизайном экрана, чтобы интерфейс не выглядел "сломанным" [src/app/(app)/profile/page.tsx:25]
  - [x] [AI-Review][Low] Скрытые ошибки сети на клиенте: В `SubscriptionCard` блок `catch` при запросе к `/api/stripe/portal` не выводит ошибку в `console.error`. Это затруднит отладку непредвиденных проблем (CORS, блокировщики рекламы) [src/features/profile/components/SubscriptionCard.tsx:87]

- [x] **Review Follow-ups (AI) - Round 9**
  - [x] [AI-Review][High] Graceful fallback при отсутствии профиля: `page.tsx` при `PGRST116` (профиль не найден) показывает вечную ошибку. Пользователь не может пользоваться личным кабинетом. Нужно обработать отсутствие профиля как нормальный сценарий и показать email из `auth.user` со статусом "Нет подписки" [src/app/(app)/profile/page.tsx:17]
  - [x] [AI-Review][High] Reverse Proxy уязвимость в `route.ts`: `new URL(request.url).origin` может указывать на внутренний адрес в Docker/Vercel. Использовать `process.env.NEXT_PUBLIC_SITE_URL` для надежного определения хоста приложения [src/app/api/stripe/portal/route.ts:58]
  - [x] [AI-Review][High] Неполные статусы Stripe в миграции: Отсутствуют `incomplete`, `incomplete_expired`, `paused`. Вебхук с этими статусами вызовет constraint violation и рассинхронизацию Stripe и БД [supabase/migrations/005_add_past_due_unpaid_status.sql]
  - [x] [AI-Review][Medium] Сломанные unit-тесты в `auth/confirm`: 6 тестов падают с ошибкой `auth_callback_error_v2`. Нарушает NFR "All tests must pass 100%" и заблокирует CI/CD [tests/unit/app/auth/confirm/route.test.ts]
  - [x] [AI-Review][Medium] Visual Jitter в `SubscriptionCard`: Из-за `useEffect` форматирования даты статус сначала рендерится "Активна", потом "Активна до [дата]". Вызывает layout shift. Лучше форматировать сразу с `suppressHydrationWarning` [src/features/profile/components/SubscriptionCard.tsx:42]

- [ ] **Review Follow-ups (AI) - Round 10**
  - [ ] [AI-Review][High] Unhandled Exception Risk: Вызов `new URL(process.env.NEXT_PUBLIC_SITE_URL)` внутри блока `catch` может выбросить ошибку (если переменная не содержит протокол), что приведет к фатальному падению функции без ответа клиенту. Использовать безопасный парсинг [src/app/api/stripe/portal/route.ts:71]
  - [ ] [AI-Review][Medium] BFCache State Lock (UX): После установки `window.location.href` состояние `isLoading` не сбрасывается. Если пользователь нажмет кнопку "Назад", страница может загрузиться из BFCache с заблокированной кнопкой [src/features/profile/components/SubscriptionCard.tsx:79]
  - [ ] [AI-Review][Medium] Ошибочный редирект для signup: Условие `type === 'signup' ? '/update-password' : ...` заставляет пользователей, зарегистрированных через Email+Пароль, немедленно менять пароль. Редирект нужен только для `recovery` [src/app/auth/confirm/route.ts:34]
  - [ ] [AI-Review][Low] In-Memory Rate Limiter: Использование `Map` для rate limiting не работает корректно в serverless (Vercel) или multi-instance окружениях. Задокументировать или рассмотреть Redis-подобное решение [src/lib/stripe/portal-rate-limit.ts:12]

- [x] **Review Follow-ups (AI) - Round 6**
  - [x] [AI-Review][High] Уязвимость Open Redirect (Security): Эндпоинт `/api/stripe/portal` слепо доверяет параметру `returnUrl` от клиента. Злоумышленник может подменить `returnUrl` (например, на фишинговый сайт). Необходима строгая валидация URL против хоста приложения [src/app/api/stripe/portal/route.ts:56]
  - [x] [AI-Review][Medium] Скрытая ошибка Rate Limit в UI (UX): Когда сервер возвращает ошибку 429, `SubscriptionCard` игнорирует ответ API и выводит хардкод "Не удалось открыть портал управления подпиской" [src/features/profile/components/SubscriptionCard.tsx:75]
  - [x] [AI-Review][Medium] Деградация O(N) при всплеске нагрузки (Performance): Условие прунинга `portalRateLimitStore.size >= 100` будет вызывать O(N) цикл `pruneExpired` при *каждом* новом запросе, если накопится более 100 активных пользователей (и их записи ещё не устареют) [src/lib/stripe/portal-rate-limit.ts:28]

- [x] **Review Follow-ups (AI) - Round 5**
  - [x] [AI-Review][High] Race condition загрузки в UI: Состояние `isLoading` сбрасывается в `finally` сразу после установки `window.location.href`, делая кнопку снова активной до того как браузер выполнит переход на Stripe Portal [src/features/profile/components/SubscriptionCard.tsx:78]
  - [x] [AI-Review][Medium] Memory Leak в Rate Limiter: Записи в `portalRateLimitStore` остаются навсегда, если пользователь больше не делает запросов [src/lib/stripe/portal-rate-limit.ts:10]
  - [x] [AI-Review][Medium] Ошибки БД (PGRST116): Отсутствие профиля у юзера вызывает фатальную ошибку 500 с записью в логи, вместо ожидаемой обработки отсутствия данных (404/400) [src/app/api/stripe/portal/route.ts:34]
  - [x] [AI-Review][Low] Ненадежный `return_url`: Формирование `${origin}/profile` на сервере может сломаться за reverse proxy; надежнее передавать текущий URL страницы с клиента [src/app/api/stripe/portal/route.ts:46]

- [x] **Review Follow-ups (AI) - Round 4**
  - [x] [AI-Review][Medium] O(N) цикл в Rate Limiter: Очистка устаревших записей итерирует всю `Map` при каждом запросе, что может заблокировать event loop при высоких нагрузках. Заменить на ленивую очистку ключа [src/lib/stripe/portal-rate-limit.ts:13]
  - [x] [AI-Review][Medium] Ошибка с часовыми поясами: Добавить `timeZone: 'UTC'` при форматировании даты окончания подписки, чтобы избежать сдвига даты на день назад в зависимости от локали [src/features/profile/components/SubscriptionCard.tsx:53]
  - [x] [AI-Review][Medium] Отсутствуют тесты: Написать unit-тесты для функций rate limiter [src/lib/stripe/portal-rate-limit.ts]
  - [x] [AI-Review][Low] Отсутствие Cache-Control заголовков: Добавить `Cache-Control: no-store` к ответу эндпоинта портала [src/app/api/stripe/portal/route.ts:54]
  - [x] [AI-Review][Low] Риск Information Disclosure: Убрать прямой вывод `data.error` от API на UI (или безопасно отфильтровать) [src/features/profile/components/SubscriptionCard.tsx:69]

- [x] **Review Follow-ups (AI) - Round 3**
  - [x] [AI-Review][High] Исправить Hydration Mismatch: перенести форматирование даты `toLocaleDateString` в useEffect или использовать server-side форматирование, чтобы избежать расхождений между сервером (UTC) и клиентом (локальная таймзона) [src/features/profile/components/SubscriptionCard.tsx:13]
  - [x] [AI-Review][Medium] Обработка фатальной ошибки БД: если `profileError` существует, немедленно возвращать HTTP 500 вместо продолжения выполнения и возврата HTTP 400 (маскировка ошибки) [src/app/api/stripe/portal/route.ts:25]
  - [x] [AI-Review][Medium] Добавить Rate Limiting: внедрить защиту от спама (rate limiter) на эндпоинт генерации сессии портала по аналогии с вебхуками, для предотвращения DoS-атак на Stripe API [src/app/api/stripe/portal/route.ts]
  - [x] [AI-Review][Low] Улучшить моки в тестах: заменить хрупкий `Object.defineProperty(window, 'location')` на безопасный `vi.stubGlobal('location', { href: '' })` [tests/unit/features/profile/components/SubscriptionCard.test.tsx:77]
  - [x] [AI-Review][Low] Покрытие Server Component: добавить юнит-тесты для `src/app/(app)/profile/page.tsx`, покрывающие логику загрузки, отсутствие авторизации и вывод ошибки БД.

- [x] **Review Follow-ups (AI) - Round 2**
  - [x] [AI-Review][Medium] Документация: обновить File List в истории, добавить `docs/stripe-supabase-nextjs16-auth-flow.md` и удаление `docs/supabase-magic-link-fix.md`
  - [x] [AI-Review][Medium] Оптимизация URL: использовать объект `Request` (`new URL(request.url).origin`) вместо `process.env.NEXT_PUBLIC_SITE_URL` для большей надежности [src/app/api/stripe/portal/route.ts]
  - [x] [AI-Review][Medium] Улучшить UX: добавить видимую пользователю обработку ошибки загрузки профиля, чтобы не было "Silent Failure" [src/app/(app)/profile/page.tsx]

- [x] **Review Follow-ups (AI)**
  - [x] [AI-Review][High] Обновить миграцию 002_add_subscription_fields.sql: изменить CHECK constraint для subscription_status, чтобы разрешить все статусы Stripe (trialing, past_due, unpaid) [supabase/migrations/002_add_subscription_fields.sql:7]
  - [x] [AI-Review][Medium] Обработать ошибки Supabase: логировать и обрабатывать объект error после вызовов .single() [src/app/(app)/profile/page.tsx:17, src/app/api/stripe/portal/route.ts:19]
  - [x] [AI-Review][Medium] Сделать безопасный парсинг дат: добавить проверку валидности даты в formatDate перед форматированием [src/features/profile/components/SubscriptionCard.tsx:8]
  - [x] [AI-Review][Low] Улучшить Skeleton загрузки: выровнять размеры и отступы в loading.tsx с реальным компонентом ProfileScreen [src/app/(app)/profile/loading.tsx:1]
  - [x] [AI-Review][Low] Улучшить обработку ошибок Stripe: возвращать более детальные и понятные пользователю сообщения об ошибках [src/app/api/stripe/portal/route.ts:43]

- [x] **Task 1: Разработка страницы Профиля (Личного кабинета)**
  - [x] Subtask 1.1: Создать страницу `src/app/(app)/profile/page.tsx` (Server Component). Маршрут должен быть защищен существующим `(app)/layout.tsx`.
  - [x] Subtask 1.2: Создать клиентский или серверный UI компонент (например, `src/features/profile/components/ProfileScreen.tsx` и `ProfileCard.tsx`) для отображения информации.
  - [x] Subtask 1.3: Запросить данные профиля из Supabase: `email` (из `auth.users` или сессии), `subscription_status`, `current_period_end` из таблицы `profiles`.

- [x] **Task 2: Интеграция Stripe Customer Portal**
  - [x] Subtask 2.1: Создать Route Handler (например, `src/app/api/stripe/portal/route.ts`) или Server Action для генерации сессии Stripe Customer Portal.
  - [x] Subtask 2.2: Внутри обработчика проверить авторизацию (через Supabase auth) и получить `stripe_customer_id` пользователя из таблицы `profiles`.
  - [x] Subtask 2.3: Вызвать `stripe.billingPortal.sessions.create({ customer: stripeCustomerId, return_url: '...' })`. `return_url` должен вести обратно на страницу профиля.
  - [x] Subtask 2.4: Вернуть URL портала на клиент для перенаправления. Обработать ошибку, если пользователь не имеет `stripe_customer_id`.

- [x] **Task 3: Интеграция UI и логики портала**
  - [x] Subtask 3.1: Добавить в UI профиля отображение текущего статуса (например, "Активна до [дата]" или "Отменена").
  - [x] Subtask 3.2: Добавить кнопку "Управление подпиской". При нажатии вызывать логику генерации ссылки портала и делать редирект (или использовать `window.location.href`).
  - [x] Subtask 3.3: Добавить Skeleton-загрузки для страницы профиля и состояние загрузки (spinner/disabled) для кнопки перехода в портал.

- [x] **Task 4: Тестирование**
  - [x] Subtask 4.1: Написать Unit-тесты для компонента профиля.
  - [x] Subtask 4.2: Написать тесты для Route Handler / Server Action логики портала.

## Dev Notes

- **Stripe Customer Portal:** Позволяет делегировать всю логику изменения платежных методов, отмены и изменения тарифов самому Stripe. Это соответствует NFR9 (управление картами делегировано Stripe).
- **Архитектурные рамки:** Feature-based структура. Логику и компоненты, специфичные для профиля, размещать в `src/features/profile/`.
- **Component Pattern:** Страница `page.tsx` выступает как Smart Container (Server Component), который получает данные и передает их в Dumb UI компоненты (например, `ProfileScreen` или `SubscriptionCard`).
- **Связь со Story 1.5:** Webhooks из Story 1.5 уже обрабатывают события отмены (`customer.subscription.deleted` и `customer.subscription.updated`). Изменения, сделанные пользователем в Customer Portal, автоматически приведут к отправке вебхуков и обновлению статуса в базе (что мы уже умеем обрабатывать).

### Project Structure Notes

- Страница: `src/app/(app)/profile/page.tsx`
- Компоненты: `src/features/profile/components/...`
- API (если используется Route Handler): `src/app/api/stripe/portal/route.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.7]
- [Source: _bmad-output/planning-artifacts/prd.md#FR2] (Отмена подписки через личный кабинет)
- [Source: _bmad-output/planning-artifacts/prd.md#FR4] (Просмотр статуса)
- [Source: src/lib/stripe/index.ts] - инициализированный клиент Stripe.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

_нет_

### Completion Notes List

- Реализована страница профиля `src/app/(app)/profile/page.tsx` (Server Component) — запрашивает email, display_name, subscription_status, current_period_end, stripe_customer_id из таблицы `profiles`.
- Создан `ProfileScreen.tsx` (Client Component) — layout страницы с блоком аккаунта и карточкой подписки.
- Создан `SubscriptionCard.tsx` (Client Component) — показывает статус подписки с датой окончания, кнопку "Управление подпиской" (скрыта если нет stripe_customer_id), состояние загрузки, отображение ошибок.
- Реализован Route Handler `POST /api/stripe/portal` — проверяет авторизацию через Supabase, получает stripe_customer_id из profiles, создаёт Stripe Customer Portal сессию, возвращает URL.
- Создан `loading.tsx` для Skeleton-загрузки страницы профиля.
- Написано 14 unit-тестов для SubscriptionCard (все ✓).
- Написано 7 unit-тестов для portal route handler (все ✓).
- TypeScript: без ошибок. Lint: новые файлы чистые (pre-existing ошибки в других файлах).
- ✅ Resolved review finding [High]: Создана миграция 005 — добавлены `past_due` и `unpaid` в CHECK constraint subscription_status (финализирует набор всех Stripe-статусов).
- ✅ Resolved review finding [Medium]: Логирование ошибок Supabase добавлено в page.tsx и portal/route.ts после вызовов `.single()`.
- ✅ Resolved review finding [Medium]: `formatDate` в SubscriptionCard.tsx теперь проверяет валидность даты через `isNaN(date.getTime())`, возвращает исходную строку при невалидном значении.
- ✅ Resolved review finding [Low]: Skeleton в loading.tsx выровнен с реальным ProfileScreen — скорректированы высоты, ширины и отступы блоков.
- ✅ Resolved review finding [Low]: Ошибка Stripe логируется с `error.message`; пользователю возвращается понятное сообщение "Не удалось открыть портал управления подпиской. Попробуйте позже."
- Итого тестов: 23 (15 SubscriptionCard + 8 portal route) — все ✓.
- ✅ Resolved review finding [Medium] Round 2: `POST(request: Request)` — `return_url` теперь формируется через `new URL(request.url).origin` без зависимости от env var; тесты обновлены (7 тестов, +1 тест "использует origin из URL запроса").
- ✅ Resolved review finding [Medium] Round 2: `page.tsx` — при `profileError` рендерит видимое сообщение об ошибке вместо silent failure.
- ✅ Resolved review finding [Medium] Round 2: File List обновлён — добавлен `docs/stripe-supabase-nextjs16-auth-flow.md`, отмечено удаление `docs/supabase-magic-link-fix.md`.
- ✅ Resolved review finding [High] Round 3: `SubscriptionCard.tsx` — `toLocaleDateString` перенесено в `useEffect` + `useState(periodEndDisplay)`, `formatDate` удалена; `getStatusLabel` принимает уже отформатированную строку. Hydration mismatch устранён.
- ✅ Resolved review finding [Medium] Round 3: `portal/route.ts` — при `profileError` немедленно возвращается HTTP 500 вместо маскировки ошибки кодом 400.
- ✅ Resolved review finding [Medium] Round 3: Создан `src/lib/stripe/portal-rate-limit.ts` (5 req/min per user); rate limit check добавлен в `portal/route.ts` — возвращает 429 при превышении.
- ✅ Resolved review finding [Low] Round 3: `SubscriptionCard.test.tsx` — `Object.defineProperty(window, 'location')` заменён на `vi.stubGlobal('location', { href: '' })` + `afterEach(() => vi.unstubAllGlobals())`.
- ✅ Resolved review finding [Low] Round 3: Создан `tests/unit/app/(app)/profile/page.test.tsx` — 5 тестов покрывают: успешную загрузку, fallback email из auth, hasStripeCustomer=false, редирект при отсутствии авторизации, вывод ошибки при profileError.
- Итого тестов: 28 (15 SubscriptionCard + 8 portal route + 5 profile page) — все ✓. TypeScript: без ошибок.
- ✅ Resolved review finding [Medium] Round 4: `portal-rate-limit.ts` — убран O(N) for-цикл по всей Map, заменён на ленивую O(1) очистку только ключа текущего пользователя.
- ✅ Resolved review finding [Medium] Round 4: `SubscriptionCard.tsx` — добавлен `timeZone: 'UTC'` в `toLocaleDateString`, чтобы дата не сдвигалась на день назад в западных локалях.
- ✅ Resolved review finding [Medium] Round 4: Создан `tests/unit/lib/stripe/portal-rate-limit.test.ts` — 7 unit-тестов покрывают: первый запрос, лимит 5 req, блокировку 6-го, независимость users, lazy reset по истечении окна, новое окно после сброса, `resetPortalRateLimitStore`.
- ✅ Resolved review finding [Low] Round 4: `portal/route.ts` — добавлен заголовок `Cache-Control: no-store` к успешному ответу; тест на наличие заголовка добавлен в `route.test.ts`.
- ✅ Resolved review finding [Low] Round 4: `SubscriptionCard.tsx` — убран прямой вывод `data.error` на UI; вместо него показывается фиксированное generic-сообщение "Не удалось открыть портал управления подпиской"; тесты обновлены.
- Итого тестов: 36 (15 SubscriptionCard + 9 portal route + 5 profile page + 7 rate-limiter) — все ✓. TypeScript: без ошибок.
- ✅ Resolved review finding [High] Round 5: `SubscriptionCard.tsx` — убран `finally`-блок; `setIsLoading(false)` вызывается только на путях ошибки. На успешном пути (редирект) `isLoading` остаётся `true` — кнопка заблокирована до навигации. Новый тест: "кнопка остаётся заблокированной после успешного редиректа".
- ✅ Resolved review finding [Medium] Round 5: `portal-rate-limit.ts` — добавлен периодический прунинг устаревших записей при достижении порога `PORTAL_RATE_LIMIT_PRUNE_THRESHOLD=100`. Экспортированы `PORTAL_RATE_LIMIT_PRUNE_THRESHOLD` и `getPortalRateLimitStoreSize` для тестирования. Новый тест: "удаляет устаревшие записи при достижении порога".
- ✅ Resolved review finding [Medium] Round 5: `portal/route.ts` — PGRST116 обрабатывается как ожидаемый кейс (профиль не найден → 400 без логирования в error). Прочие ошибки БД по-прежнему возвращают 500. Новый тест: "возвращает 400 при PGRST116".
- ✅ Resolved review finding [Low] Round 5: `SubscriptionCard.tsx` + `portal/route.ts` — клиент передаёт `window.location.origin + '/profile'` в теле запроса; сервер использует его как `return_url` (с валидацией http/https). Fallback на `new URL(request.url).origin` при отсутствии тела. Новый тест: "использует returnUrl переданный клиентом (надёжно за reverse proxy)".
- ✅ Resolved review finding [High] Round 6: `portal/route.ts` — добавлена строгая валидация `returnUrl` против `new URL(request.url).origin` (защита от Open Redirect). Тесты обновлены: добавлен кейс для фишингового домена.
- ✅ Resolved review finding [Medium] Round 6: `SubscriptionCard.tsx` — при получении 429 (Rate Limit) ошибки пользователю теперь отображается текст из ответа ("Слишком много запросов. Попробуйте позже.") вместо общей ошибки. Добавлен тест.
- ✅ Resolved review finding [Medium] Round 6: `portal-rate-limit.ts` — O(N) цикл в функции `pruneExpired` заменён на частичный обход (до 100 элементов за один вызов).
- Итого тестов: 43 (17 SubscriptionCard + 12 portal route + 5 profile page + 8 rate-limiter + 1 pruning) — все ✓. TypeScript: без ошибок.
- ✅ Resolved review finding [Critical] Round 7: `portal/route.ts` — `startsWith` заменён на `new URL(clientReturnUrl).origin === requestOrigin` с try/catch; защита от subdomain-spoofing (procontent.ru.evil.com → blocked). Новый тест: "блокирует subdomain-spoofing".
- ✅ Resolved review finding [Medium] Round 7: `portal-rate-limit.ts` — удалён `!entry &&` в условии прунинга; теперь прунинг триггерится и для пользователей с истёкшим окном, не только для новых. Новый тест: "триггер на истёкшую запись существующего пользователя".
- ✅ Resolved review finding [Medium] Round 7: `portal/route.ts` — добавлен заголовок `Retry-After: 60` в ответ 429. Новый тест: "устанавливает Retry-After: 60 заголовок в ответе 429".
- ✅ Resolved review finding [Medium] Round 7: `SubscriptionCard.test.tsx` — добавлен тест для `unpaid` → "Не оплачена".
- ✅ Resolved review finding [Low] Round 7: `portal-rate-limit.ts` — off-by-one исправлен: `> 100` → `>= 100` (теперь ровно 100 элементов).
- ✅ Resolved review finding [Low] Round 7: `portal-rate-limit.ts` — `resetPortalRateLimitStore` и `getPortalRateLimitStoreSize` защищены `NODE_ENV !== 'test'` guard — не выполняют действий в production.
- ✅ Resolved review finding [Low] Round 7: Создан `tests/unit/features/profile/components/ProfileScreen.test.tsx` — 5 тестов покрывают: heading, email, displayName (есть/null), SubscriptionCard render.
- ✅ Resolved review finding [Low] Round 7: Создан `tests/unit/app/(app)/profile/loading.test.tsx` — 4 теста: рендер, main-элемент, animate-pulse, 2 bordered sections.
- Итого тестов: 50 (18 SubscriptionCard + 14 portal route + 5 profile page + 9 rate-limiter + 4 loading + 5 ProfileScreen) — все ✓. TypeScript: без ошибок.
- ✅ Resolved review finding [High] Round 8: `portal-rate-limit.ts` — `pruneExpired` переписан: теперь итерирует Map с начала до первой живой записи (O(k) вместо фиксированных 100). `consumePortalRateLimit` использует `delete` + `set` при сбросе окна — ключ перемещается в конец Map, поддерживая LRU-порядок. Добавлен тест "сохраняет свежие записи в конце Map при прунинге устаревших с начала".
- ✅ Resolved review finding [Medium] Round 8: `page.tsx` — ошибочный `<main>` теперь включает `<h1>Профиль</h1>` и `space-y-8`, интерфейс консистентен с реальным экраном профиля. Тест обновлён: проверяет наличие heading "Профиль" в ошибочном состоянии.
- ✅ Resolved review finding [Low] Round 8: `SubscriptionCard.tsx` — catch-блок логирует ошибку через `console.error('[SubscriptionCard] ...')`. Добавлен тест "логирует ошибку в console.error при сетевом сбое".
- Итого тестов: 52 (19 SubscriptionCard + 14 portal route + 5 profile page + 10 rate-limiter + 4 loading + 5 ProfileScreen) — все ✓. TypeScript: без ошибок.
- ✅ Code Review Round 9: Созданы 5 action items для исправления критических и средних проблем, найденных в adversarial review. Статус истории изменен на "in-progress" — необходимо выполнить исправления перед финальным завершением.
- ✅ Resolved review finding [High] Round 9: `page.tsx` — PGRST116 обрабатывается как нормальный сценарий: рендерится `ProfileScreen` с email из `auth.user` и subscriptionStatus=null. Новый тест: "показывает ProfileScreen с email из auth при PGRST116".
- ✅ Resolved review finding [High] Round 9: `portal/route.ts` — `new URL(request.url).origin` заменён на `process.env.NEXT_PUBLIC_SITE_URL ? new URL(SITE_URL).origin : request.url.origin`. Fallback сохранён для локальной разработки. Новый тест: "использует NEXT_PUBLIC_SITE_URL вместо request.url.origin".
- ✅ Resolved review finding [High] Round 9: Создана миграция `006_add_incomplete_paused_status.sql` — добавлены `incomplete`, `incomplete_expired`, `paused` в CHECK constraint subscription_status. Финализирован полный набор всех Stripe-статусов.
- ✅ Resolved review finding [Medium] Round 9: `auth/confirm/route.ts` + `route.test.ts` — root cause: отсутствие `SUPABASE_SERVICE_ROLE_KEY` в `beforeEach` + нет мока `getUser`. Также восстановлен type-specific редирект (`recovery`/`signup` → `/update-password`). Все 6 тестов проходят ✓.
- ✅ Resolved review finding [Medium] Round 9: `SubscriptionCard.tsx` — убран `useEffect` для форматирования даты; `formatPeriodEnd` вызывается синхронно (timeZone: 'UTC' гарантирует одинаковый SSR/CSR вывод). Добавлен `suppressHydrationWarning` на элемент статуса. Layout shift устранён.
- Итого тестов: 57 (19 SubscriptionCard + 15 portal route + 6 profile page + 10 rate-limiter + 4 loading + 5 ProfileScreen + 6 auth/confirm) — все ✓. TypeScript: без ошибок.

### File List

- `src/app/(app)/profile/page.tsx` (новый)
- `src/app/(app)/profile/loading.tsx` (новый)
- `src/features/profile/components/ProfileScreen.tsx` (новый)
- `src/features/profile/components/SubscriptionCard.tsx` (новый)
- `src/app/api/stripe/portal/route.ts` (новый)
- `tests/unit/features/profile/components/SubscriptionCard.test.tsx` (новый)
- `tests/unit/app/api/stripe/portal/route.test.ts` (новый)
- `_bmad-output/implementation-artifacts/stories/1-7-personal-account-and-subscription-management.md` (обновлён)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (обновлён)
- `supabase/migrations/005_add_past_due_unpaid_status.sql` (новый)
- `src/app/(app)/profile/page.tsx` (обновлён — логирование ошибки Supabase)
- `src/app/api/stripe/portal/route.ts` (обновлён — логирование ошибок Supabase и Stripe, улучшено сообщение об ошибке)
- `src/features/profile/components/SubscriptionCard.tsx` (обновлён — безопасный парсинг дат)
- `src/app/(app)/profile/loading.tsx` (обновлён — выровнен skeleton)
- `tests/unit/features/profile/components/SubscriptionCard.test.tsx` (обновлён — тест невалидной даты)
- `tests/unit/app/api/stripe/portal/route.test.ts` (обновлён — тесты ошибки Supabase и сообщения Stripe)
- `docs/stripe-supabase-nextjs16-auth-flow.md` (новый, добавлен в sprint)
- `docs/supabase-magic-link-fix.md` (удалён)
- `src/app/api/stripe/portal/route.ts` (обновлён — Request param, `new URL(request.url).origin`)
- `src/app/(app)/profile/page.tsx` (обновлён — видимый UI при ошибке загрузки профиля)
- `tests/unit/app/api/stripe/portal/route.test.ts` (обновлён — новая сигнатура POST, тест origin из URL)
- `src/features/profile/components/SubscriptionCard.tsx` (обновлён — hydration mismatch fix: `toLocaleDateString` в useEffect)
- `src/app/api/stripe/portal/route.ts` (обновлён — HTTP 500 при profileError, rate limiting)
- `src/lib/stripe/portal-rate-limit.ts` (новый — per-user rate limiter 5 req/min)
- `tests/unit/features/profile/components/SubscriptionCard.test.tsx` (обновлён — vi.stubGlobal вместо Object.defineProperty)
- `tests/unit/app/api/stripe/portal/route.test.ts` (обновлён — тест 500 вместо 400 для DB error, тест 429 rate limit)
- `tests/unit/app/(app)/profile/page.test.tsx` (новый — 5 unit-тестов для Server Component)
- `src/lib/stripe/portal-rate-limit.ts` (обновлён — O(N) for-цикл заменён на O(1) ленивую очистку)
- `src/features/profile/components/SubscriptionCard.tsx` (обновлён — timeZone: 'UTC' в toLocaleDateString; generic error вместо data.error)
- `src/app/api/stripe/portal/route.ts` (обновлён — Cache-Control: no-store в успешном ответе)
- `tests/unit/lib/stripe/portal-rate-limit.test.ts` (новый — 7 unit-тестов для rate limiter)
- `tests/unit/app/api/stripe/portal/route.test.ts` (обновлён — тест Cache-Control заголовка)
- `tests/unit/features/profile/components/SubscriptionCard.test.tsx` (обновлён — тесты generic error вместо data.error)
- `src/features/profile/components/SubscriptionCard.tsx` (обновлён — race condition fix: isLoading не сбрасывается при редиректе; передаёт returnUrl клиента в теле запроса)
- `src/lib/stripe/portal-rate-limit.ts` (обновлён — pruneExpired при PORTAL_RATE_LIMIT_PRUNE_THRESHOLD; экспорт PORTAL_RATE_LIMIT_PRUNE_THRESHOLD и getPortalRateLimitStoreSize)
- `src/app/api/stripe/portal/route.ts` (обновлён — защита от Open Redirect для returnUrl)
- `tests/unit/app/api/stripe/portal/route.test.ts` (обновлён — тест фишингового домена в returnUrl)
- `src/features/profile/components/SubscriptionCard.tsx` (обновлён — отображение сообщения ошибки 429 Rate Limit)
- `tests/unit/features/profile/components/SubscriptionCard.test.tsx` (обновлён — тест отображения ошибки 429)
- `src/lib/stripe/portal-rate-limit.ts` (обновлён — ограничение обхода Map в pruneExpired до 100 элементов для защиты от O(N))
- `src/app/api/stripe/portal/route.ts` (обновлён — subdomain-spoofing fix: new URL().origin === requestOrigin; Retry-After: 60 в ответе 429)
- `src/lib/stripe/portal-rate-limit.ts` (обновлён — pruning для expired active users; off-by-one fix >= 100; NODE_ENV guards)
- `tests/unit/app/api/stripe/portal/route.test.ts` (обновлён — тест subdomain-spoofing, тест Retry-After заголовка)
- `tests/unit/features/profile/components/SubscriptionCard.test.tsx` (обновлён — тест unpaid статуса)
- `tests/unit/lib/stripe/portal-rate-limit.test.ts` (обновлён — тест pruning через expired active user)
- `tests/unit/features/profile/components/ProfileScreen.test.tsx` (новый — 5 unit-тестов)
- `tests/unit/app/(app)/profile/loading.test.tsx` (новый — 4 unit-теста)
- `src/lib/stripe/portal-rate-limit.ts` (обновлён — LRU-порядок: pruneExpired с начала Map, delete+set при сбросе окна)
- `src/app/(app)/profile/page.tsx` (обновлён — ошибочный UI сохраняет заголовок Профиль и структуру страницы)
- `src/features/profile/components/SubscriptionCard.tsx` (обновлён — console.error в catch-блоке)
- `tests/unit/lib/stripe/portal-rate-limit.test.ts` (обновлён — тест LRU-порядка pruning)
- `tests/unit/app/(app)/profile/page.test.tsx` (обновлён — тест проверяет heading при ошибке)
- `tests/unit/features/profile/components/SubscriptionCard.test.tsx` (обновлён — тест console.error при сетевом сбое)
- `src/app/(app)/profile/page.tsx` (обновлён — PGRST116 graceful fallback: рендерит ProfileScreen с auth email)
- `src/app/api/stripe/portal/route.ts` (обновлён — NEXT_PUBLIC_SITE_URL для надёжного определения origin за reverse proxy)
- `src/app/auth/confirm/route.ts` (обновлён — type-specific редирект: recovery/signup → /update-password)
- `src/features/profile/components/SubscriptionCard.tsx` (обновлён — убран useEffect, синхронный formatPeriodEnd + suppressHydrationWarning)
- `supabase/migrations/006_add_incomplete_paused_status.sql` (новый — добавлены incomplete, incomplete_expired, paused в CHECK constraint)
- `tests/unit/app/(app)/profile/page.test.tsx` (обновлён — тест PGRST116 graceful fallback)
- `tests/unit/app/api/stripe/portal/route.test.ts` (обновлён — тест NEXT_PUBLIC_SITE_URL)
- `tests/unit/app/auth/confirm/route.test.ts` (обновлён — SUPABASE_SERVICE_ROLE_KEY, getUser mock, stripe mock)
- `_bmad-output/implementation-artifacts/stories/1-7-personal-account-and-subscription-management.md` (обновлён — Round 8 выполнен, статус review)
