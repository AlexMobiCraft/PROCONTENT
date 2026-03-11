# Story 1.4: Интеграция Stripe Checkout

Status: review

## Story

As a посетительница,
I want нажать кнопку оплаты на лендинге и выбрать тариф (12,99€/мес или 34€/3 мес),
so that оформить подписку через надёжный шлюз Stripe.

## Acceptance Criteria

1. **Given** лендинг с секцией `PricingSection` и выбранным тарифом (monthly или quarterly)
   **When** посетительница нажимает кнопку "Вступить сейчас"
   **Then** браузер перенаправляет её на защищённую сессию Stripe Checkout по URL, возвращённому сервером
   **And** URL генерируется через Route Handler `POST /api/checkout` (секретный ключ Stripe НИКОГДА не покидает сервер)

2. **Given** посетительница находится на странице Stripe Checkout
   **When** страница загружается
   **Then** в checkout отображается только тот тариф, который она выбрала на лендинге (monthly = €12,99/мес или quarterly = €34/3 мес)
   **And** локаль Stripe установлена в `sl` (словенский)

3. **Given** посетительница успешно оплатила подписку на Stripe
   **When** Stripe перенаправляет её обратно на сайт
   **Then** происходит редирект на `{NEXT_PUBLIC_SITE_URL}/onboarding?session_id={CHECKOUT_SESSION_ID}`
   **And** `session_id` в URL позволит Story 1.7 отобразить персонализированный онбординг

4. **Given** посетительница нажала "Отмена" или закрыла Stripe Checkout
   **When** Stripe перенаправляет её обратно
   **Then** происходит редирект на `{NEXT_PUBLIC_SITE_URL}/#pricing` (возврат к секции с тарифами)

5. **Given** Route Handler `POST /api/checkout` получает некорректный тариф или возникает ошибка Stripe
   **When** запрос обрабатывается
   **Then** возвращается HTTP 400/500 с понятным сообщением
   **And** клиент показывает системное Toast-уведомление об ошибке ("Не удалось начать оформление. Попробуйте снова.")
   **And** кнопка разблокируется для повторной попытки

6. **Given** кнопка "Вступить сейчас" нажата
   **When** идёт загрузка (ожидание ответа от `/api/checkout`)
   **Then** кнопка переходит в disabled-состояние с визуальным индикатором загрузки
   **And** touch target сохраняется `min-h-[48px]` (соблюдение NFR14)

## Tasks / Subtasks

- [x] **Task 1: Установка Stripe SDK и настройка окружения** (AC: 1)
  - [x] Subtask 1.1: Установить пакет `npm install stripe` (server-side SDK, последняя стабильная версия)
  - [x] Subtask 1.2: Добавить в `.env.local` переменные:
    ```
    STRIPE_SECRET_KEY=sk_test_...
    STRIPE_MONTHLY_PRICE_ID=price_...
    STRIPE_QUARTERLY_PRICE_ID=price_...
    NEXT_PUBLIC_SITE_URL=http://localhost:3000
    ```
    ⚠️ `STRIPE_SECRET_KEY` — без префикса `NEXT_PUBLIC_`, иначе это критическая уязвимость безопасности
  - [x] Subtask 1.3: Добавить те же ключи в `.env.example` с placeholder-значениями (без реальных ключей)
  - [x] Subtask 1.4: Добавить в `next.config.mjs` переменную `NEXT_PUBLIC_SITE_URL` в `env` config (если требуется)

- [x] **Task 2: Создание Stripe helper** (AC: 1)
  - [x] Subtask 2.1: Создать `src/lib/stripe/index.ts` — инициализация Stripe-клиента:
    ```typescript
    import Stripe from 'stripe'

    export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '...', // Определить актуальную apiVersion из установленного пакета stripe (проверить node_modules/stripe/package.json, types или CHANGELOG.md)
      typescript: true,
    })
    ```
    ⚠️ Этот файл ТОЛЬКО для серверного использования. Никогда не импортировать в `'use client'` компоненты.

- [x] **Task 3: Создание Route Handler для Checkout** (AC: 1, 2, 3, 4, 5)
  - [x] Subtask 3.1: Создать `src/app/api/checkout/route.ts`:
    - Метод: `POST`
    - Тело запроса: `{ plan: 'monthly' | 'quarterly' }`
    - Парсинг тела: обернуть `request.json()` в try/catch — при ошибке парсинга (невалидный JSON, отсутствие `Content-Type: application/json`) → вернуть 400 с сообщением `'Некорректный формат запроса'`
    - Валидация: если `plan` не `monthly` или `quarterly` → вернуть 400
    - Выбор Price ID: `plan === 'monthly' ? process.env.STRIPE_MONTHLY_PRICE_ID : process.env.STRIPE_QUARTERLY_PRICE_ID`
    - Создание сессии:
      ```typescript
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/#pricing`,
        locale: 'sl',
        allow_promotion_codes: true,
      })
      ```
    - Вернуть: `NextResponse.json({ url: session.url }, { status: 200 })`
    - Обёрнуть в try/catch: при ошибке Stripe → `NextResponse.json({ error: 'Ошибка при создании сессии' }, { status: 500 })`
  - [x] Subtask 3.2: Убедиться, что файл НЕ имеет `'use client'` директивы (Route Handlers — серверный код)

- [x] **Task 4: Обновление архитектуры лендинга — подключение Checkout (Smart/Dumb)** (AC: 1, 2, 5, 6)
  - [x] Subtask 4.1: Создать API helper `src/features/landing/api/checkout.ts` (или добавить функцию সরাসরি в `src/app/page.tsx`):
    - Функция делает вызов `fetch` к `POST /api/checkout` с `{ plan }`.
    - При ошибке выбрасывает `Error` с сообщением от сервера.
  - [x] Subtask 4.2: Обновить Smart-контейнер лендинга (`src/app/page.tsx`):
    - Добавить состояние (в самом верху компонента, если он `"use client"`, или вынести логику в оболочку-контейнер): `const [isCheckoutLoading, setIsCheckoutLoading] = useState(false)`.
    - Создать handler `handleCheckout(plan)`: вызывает API (Subtask 4.1), делает `window.location.href = url` при успехе.
    - При возникновении ошибки (в блоке `catch()`) вызвать глобальный toast (например, из библиотеки sonner): `toast.error('Не удалось начать оформление. Попробуйте снова.')` и сбросить загрузку.
    - Передать `isCheckoutLoading` и `handleCheckout` как props вниз в `PricingSection`.
  - [x] Subtask 4.3: Обновить Dumb UI `src/features/landing/components/PricingSection.tsx` (или `src/components/landing/PricingSection.tsx` в зависимости от того, как реализована Story 1.3):
    - Добавить принимаемые properties: `{ onCheckout: (plan: 'monthly' | 'quarterly') => void, isLoading: boolean }`.
    - Заменить `<Link href="/login">` на `<button>` с `onClick={() => onCheckout(selected)}` и `disabled={isLoading}`.
    - Сохранить все существующие классы кнопки + добавить `disabled:opacity-50 disabled:cursor-not-allowed`.
    - Кнопка в disabled-состоянии должна показывать текст "Загрузка..." или добавлять spinner. Проверить сохранение размера `min-h-[48px]`.

- [x] **Task 5: Написание тестов** (AC: 1, 5)
  - [x] Subtask 5.1: Создать `tests/unit/app/api/checkout/route.test.ts`:
    - Mock `stripe.checkout.sessions.create` через jest.mock/vi.mock
    - Тест: `POST { plan: 'monthly' }` → returns `{ url: 'https://checkout.stripe.com/...' }` со статусом 200
    - Тест: `POST { plan: 'quarterly' }` → использует `STRIPE_QUARTERLY_PRICE_ID`
    - Тест: `POST { plan: 'invalid' }` → returns 400
    - Тест: невалидный JSON в теле запроса → returns 400
    - Тест: Stripe выбрасывает ошибку → returns 500
  - [x] Subtask 5.2: Создать `tests/unit/features/landing/components/PricingSection.checkout.test.tsx`:
    - Mock `fetch` через `vi.fn()` или `jest.fn()`
    - Тест: клик на кнопку → кнопка переходит в disabled во время загрузки
    - Тест: успешный ответ `{ url: '...' }` → `window.location.href` установлен
    - Тест: ошибочный ответ → показывается inline-сообщение об ошибке
    - Тест: кнопка с `aria-disabled` или `disabled` атрибутом во время загрузки

### Review Follow-ups (AI)
- [x] [AI-Review][High] Исправить AC 5: реализовать системное Toast-уведомление (например, через `sonner`) вместо inline-ошибки [src/features/landing/components/PricingCheckoutWrapper.tsx:19]
- [x] [AI-Review][Medium] Добавить логирование ошибок (`console.error`) в `catch` блоках [src/app/api/checkout/route.ts:9]
- [x] [AI-Review][Medium] Добавить проверку наличия Environment Variables для Stripe Price ID [src/app/api/checkout/route.ts:19]
- [x] [AI-Review][Medium] Избегать Type Casting (`url!`) в клиентском API-хелпере [src/features/landing/api/checkout.ts:14]
- [x] [AI-Review][Medium] Добавить недостающие тесты для Smart-контейнера `PricingCheckoutWrapper.tsx`

### Review Follow-ups (Code Review)
- [x] [AI-Review][High] Исправить потенциальный баг с отсутствующим `process.env.NEXT_PUBLIC_SITE_URL` при генерации URL [src/app/api/checkout/route.ts:33]
- [x] [AI-Review][High] Добавить try/catch обработку `await response.json()` на случай падения сервера с 500 HTML [src/features/landing/api/checkout.ts:8]
- [x] [AI-Review][Medium] Добавить валидацию и Throw Error при отсутствии `STRIPE_SECRET_KEY` при инициализации [src/lib/stripe/index.ts:3]
- [x] [AI-Review][Medium] Добавить тест на проверку граничного условия отсутствия `NEXT_PUBLIC_SITE_URL` [tests/unit/app/api/checkout/route.test.ts]
- [x] [AI-Review][Low] Использовать `role="radio"` и `role="radiogroup"` вместо кнопок для выбора тарифа [src/features/landing/components/PricingSection.tsx:76]
- [x] [AI-Review][Low] Улучшить обработку чисто сетевых `TypeError` ошибок у fetch [src/features/landing/api/checkout.ts:11]

## Dev Notes

### Критически важный контекст (предыдущие истории)

**Story 1.3 (done):** `PricingSection` уже реализован. Следует определить его путь (вероятнее всего `src/features/landing/components/PricingSection.tsx` или `src/components/landing/PricingSection.tsx`).
- Компонент использует `useState` для выбора тарифа: `monthly` vs `quarterly`.
- CTA кнопка сейчас ссылается на `/login` — **меняем на тег `<button>`**.
- **ОБНОВЛЕНИЕ АРХИТЕКТУРЫ:** `PricingSection` переходит в разряд полностью Dumb (представление). Вся бизнес-логика (`fetch` и Toasts) и стейт `isLoading` выносятся в Smart Component: `src/app/page.tsx` или специально созданный клиентский враппер-секцию лендинга, в зависимости от того, как сейчас собран лендинг. Ошибка из `fetch` будет вызывать Toast.

**Story 1.2 (done):** Паттерн API-функций в `src/features/auth/api/auth.ts` — вызовы из клиентских компонентов без useEffect (inline async handlers). Придерживаться того же паттерна.

**Stripe не установлен** — первое, что нужно сделать в Task 1.1.

**`src/lib/stripe/` не существует** — создать вместе с `index.ts`.

### Архитектурные границы (ОБЯЗАТЕЛЬНО соблюдать)

**Разделение Server / Client:**
| Слой | Файл | Правило |
|------|------|---------|
| Server | `src/lib/stripe/index.ts` | Только серверный импорт. **Никогда** `import` в `'use client'` компоненте |
| Server | `src/app/api/checkout/route.ts` | Route Handler — всегда серверный код. Без `'use client'` |
| Client | `src/features/landing/components/PricingSection.tsx` | Вызывает `/api/checkout` через `fetch`, НЕ импортирует `stripe` напрямую |

**Feature-based structure:** `src/lib/stripe/` — не в `features/`, потому что это shared utility без UI. Если в будущем появится логика управления подпиской (Customer Portal) — она идёт в `src/features/auth/`.

**Соответствие архитектуре:** Route Handlers → `src/app/api/` (строго по architecture.md#Requirements-to-Structure-Mapping).

### Структура новых файлов

```
src/
├── app/
│   ├── api/
│   │   └── checkout/
│   │       └── route.ts          # NEW — POST handler
│   └── page.tsx                  # MODIFY — Smart Container (управляет логикой isCheckoutLoading)
├── lib/
│   └── stripe/
│       └── index.ts              # NEW — Stripe client singleton
└── features/ (или components/landing/)
    └── landing/
        ├── api/
        │   └── checkout.ts       # NEW — Клиентский fetch helper-сервис (опция)
        └── components/
            └── PricingSection.tsx # MODIFY — переводится в Dumb Component (props onCheckout, isLoading)
tests/
└── unit/
    ├── app/
    │   └── api/
    │       └── checkout/
    │           └── route.test.ts  # NEW
    └── features/
        └── landing/
            └── components/
                └── PricingSection.checkout.test.tsx  # NEW
```

### Stripe API — конкретные детали

**Минимальный набор параметров `sessions.create`:**
```typescript
{
  mode: 'subscription',
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: `${baseUrl}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${baseUrl}/#pricing`,
  locale: 'sl',           // Словенский интерфейс Stripe
  allow_promotion_codes: true,
}
```

**`{CHECKOUT_SESSION_ID}` в success_url** — это буквальная шаблонная строка Stripe (в фигурных скобках). Stripe подставит реальный ID при редиректе. Не заменять на JS-переменную!

**Stripe Price IDs** — статические значения из Stripe Dashboard → Products → Prices. Не путать с Product ID. Формат: `price_1AbCdEf...`.

**Версия API Stripe:** При создании Stripe-клиента указывать `apiVersion`. Проверить актуальную версию в документации `stripe` npm пакета (в `CHANGELOG.md` или `stripe.d.ts`). Не использовать устаревшую версию.

**Тест-режим:** Используй `sk_test_...` ключи в разработке. Stripe Checkout в test-режиме принимает карту `4242 4242 4242 4242`, любой будущий срок, любой CVC.

### Обработка ошибок

Паттерн из architecture.md (Strict Enforcement):
- **Системные ошибки** (сетевые, сбой Stripe API, возврат 400/500 от `/api/checkout`) → Обязательный вызов глобального уведомления Toast (например `toast.error('...')`). Вызов `/api/checkout` — это чистая системная мутация API, мы НЕ используем инлайн-сообщения локального стейта компонента.
- Кнопка должна разблокироваться после ошибки, чтобы пользователь мог повторить попытку
- `window.location.href` используется для редиректа на Stripe Checkout (не `router.push()` — это внешний URL)

### Переменные окружения

```bash
# .env.local (добавить)
STRIPE_SECRET_KEY=sk_test_...          # Секретный ключ — ТОЛЬКО серверный
STRIPE_MONTHLY_PRICE_ID=price_...     # Price ID тарифа €12,99/мес
STRIPE_QUARTERLY_PRICE_ID=price_...   # Price ID тарифа €34/3 мес
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # Уже должна быть из CLAUDE.md
```

⚠️ `NEXT_PUBLIC_SITE_URL` уже упомянута в `CLAUDE.md` как базовый URL сайта — убедиться, что она есть в `.env.local`.

### Что НЕ делать в этой истории

- **НЕ создавать** таблицу `subscriptions` в БД — это Story 1.5 (Webhooks)
- **НЕ реализовывать** онбординг-страницу `/onboarding` — это Story 1.7
- **НЕ устанавливать** `@stripe/stripe-js` — он нужен только для Stripe Elements (кастомные формы оплаты). Для Checkout Redirect достаточно server-side `stripe`
- **НЕ добавлять** `customer_email` в `sessions.create` — посетительница ещё не авторизована, Stripe сам запросит email
- **НЕ менять** дизайн PricingSection — только поведение кнопки
- **НЕ реализовывать** rate limiting для Route Handler — будет добавлен в отдельной истории

### Тестовый фреймворк

Из Story 1.3 DevNotes: тесты используют Vitest (`vi.fn()`, `vi.mock()`). Конфигурация уже настроена. Структура тестов в `tests/unit/features/landing/components/`.

Для тестирования Route Handler используется паттерн из Story 1.3: импортировать handler и вызывать с mock `Request`:
```typescript
import { POST } from '@/app/api/checkout/route'
const request = new Request('http://localhost/api/checkout', {
  method: 'POST',
  body: JSON.stringify({ plan: 'monthly' }),
})
const response = await POST(request)
```

### References

- [Architecture — Integration Points](file:///C:/Users/1/DEV/PROCONTENT/_bmad-output/planning-artifacts/architecture.md#Integration-Points)
- [Architecture — Project Structure](file:///C:/Users/1/DEV/PROCONTENT/_bmad-output/planning-artifacts/architecture.md#Complete-Project-Directory-Structure)
- [Epics — Story 1.4](file:///C:/Users/1/DEV/PROCONTENT/_bmad-output/planning-artifacts/epics.md#story-14-интеграция-stripe-checkout)
- [Story 1.3 Dev Notes](file:///C:/Users/1/DEV/PROCONTENT/_bmad-output/implementation-artifacts/stories/1-3-public-landing-landing-page-ui.md) — паттерны компонентов, шрифты, цветовые токены
- [UX Spec — Journey 1 (Stripe Checkout flow)](file:///C:/Users/1/DEV/PROCONTENT/_bmad-output/planning-artifacts/ux-design-specification.md)
- [Stripe Docs — Checkout Sessions](https://stripe.com/docs/api/checkout/sessions/create)
- [NFR6] HTTPS обязателен — Vercel обеспечивает автоматически
- [NFR9] Карточные данные не хранятся — полностью делегировано Stripe

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

Исправление hoisting: заменил `const mockSessionsCreate = vi.fn()` на `vi.hoisted(() => vi.fn())` в route.test.ts — стандартная Vitest практика для фабрик `vi.mock`.

### Completion Notes List

- Task 1: Установлен `stripe@20.4.1`. Переменные добавлены в `.env.local` и `.env.example`. `next.config.ts` не требовал изменений (NEXT_PUBLIC_ переменные автоматически доступны).
- Task 2: Создан `src/lib/stripe/index.ts` с apiVersion `2026-02-25.clover` (из `node_modules/stripe/cjs/apiVersion.js`).
- Task 3: Создан `src/app/api/checkout/route.ts` — POST handler без `'use client'`. Валидация plan, try/catch для JSON-парсинга и Stripe-ошибок. Буквальная шаблонная строка `{CHECKOUT_SESSION_ID}` для Stripe.
- Task 4: `page.tsx` — Server Component, поэтому состояние и обработчик вынесены в `PricingCheckoutWrapper.tsx` (новый Client Component). `PricingSection` стал Dumb Component с props `onCheckout`, `isLoading`, `errorMessage`. Inline error state вместо `sonner` (не установлен; тесты ожидают `role="alert"` — inline подход).
- Task 5: 12 тестов (5 route + 7 PricingSection). Все 109 тестов проходят. TypeScript: 0 ошибок.
- ✅ Resolved review finding [High]: Установлен `sonner@^2`, добавлен `<Toaster />` в layout.tsx, `PricingCheckoutWrapper` использует `toast.error()` вместо inline-ошибки, `errorMessage` prop удалён из `PricingSection`.
- ✅ Resolved review finding [Medium]: Добавлен `console.error` в оба `catch` блока `route.ts`.
- ✅ Resolved review finding [Medium]: Добавлена проверка `if (!priceId)` с возвратом 500 до вызова Stripe.
- ✅ Resolved review finding [Medium]: Удалён `url!` в `checkout.ts` — заменён явной проверкой `if (!data.url)`.
- ✅ Resolved review finding [Medium]: Создан `PricingCheckoutWrapper.test.tsx` — 5 тестов (loading state, redirect, toast.error, кнопка разблокируется, fallback toast). Итого: 113 тестов, 0 ошибок TypeScript.
- ✅ Resolved code-review finding [High]: Добавлена проверка `NEXT_PUBLIC_SITE_URL` в `route.ts` до вызова Stripe — возврат 500 при отсутствии. Добавлен тест в `route.test.ts`. `route.ts` теперь использует переменную `siteUrl` вместо `process.env.*` напрямую в строке.
- ✅ Resolved code-review finding [High]: `checkout.ts` — обёрнут `fetch` в try/catch (сетевые `TypeError`), `response.json()` в отдельный try/catch (500 HTML-ответ от сервера). 114 тестов, 0 ошибок TypeScript.
- ✅ Resolved code-review finding [Medium]: `stripe/index.ts` — явная проверка `STRIPE_SECRET_KEY` с `throw new Error(...)` до инициализации Stripe. Быстрый сбой при неверной конфигурации.
- ✅ Resolved code-review finding [Medium]: Добавлен тест `возвращает 500 если отсутствует NEXT_PUBLIC_SITE_URL` в `route.test.ts`. Всего 114 тестов.
- ✅ Resolved code-review finding [Low]: Тогл тарифов в `PricingSection.tsx` — `role="radiogroup"` на обёртке, `role="radio"` + `aria-checked` на кнопках вместо `aria-pressed`.
- ✅ Resolved code-review finding [Low]: `checkout.ts` — сетевые ошибки (`TypeError` от fetch) пойманы отдельным try/catch с user-friendly сообщением.

### File List

- `package.json` (модифицирован — добавлен `stripe@20.4.1`)
- `package-lock.json` (модифицирован)
- `.env.local` (модифицирован — добавлены Stripe переменные)
- `.env.example` (модифицирован — добавлены Stripe переменные-placeholders)
- `src/lib/stripe/index.ts` (создан)
- `src/app/api/checkout/route.ts` (создан)
- `src/features/landing/api/checkout.ts` (создан)
- `src/features/landing/components/PricingCheckoutWrapper.tsx` (создан)
- `src/features/landing/components/PricingSection.tsx` (модифицирован)
- `src/app/page.tsx` (модифицирован)
- `tests/unit/app/api/checkout/route.test.ts` (модифицирован — добавлен тест missing Price ID env)
- `tests/unit/features/landing/components/PricingSection.checkout.test.tsx` (модифицирован — удалены тесты errorMessage)
- `tests/unit/features/landing/components/PricingCheckoutWrapper.test.tsx` (создан)
- `package.json` (модифицирован — добавлен `sonner`)
- `package-lock.json` (модифицирован)
- `src/app/layout.tsx` (модифицирован — добавлен `<Toaster />`)
- `src/features/landing/components/PricingCheckoutWrapper.tsx` (модифицирован — toast вместо inline-ошибки)
- `src/features/landing/components/PricingSection.tsx` (модифицирован — удалён prop `errorMessage`)
- `src/features/landing/api/checkout.ts` (модифицирован — убран `url!`, добавлена явная проверка)
- `src/app/api/checkout/route.ts` (модифицирован — console.error + проверка env Price ID + проверка NEXT_PUBLIC_SITE_URL)
