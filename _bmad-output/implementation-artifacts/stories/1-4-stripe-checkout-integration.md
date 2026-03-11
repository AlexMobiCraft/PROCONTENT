# Story 1.4: Интеграция Stripe Checkout

Status: ready-for-dev

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
   **And** клиент показывает Toast с ошибкой ("Не удалось начать оформление. Попробуйте снова.")
   **And** кнопка разблокируется для повторной попытки

6. **Given** кнопка "Вступить сейчас" нажата
   **When** идёт загрузка (ожидание ответа от `/api/checkout`)
   **Then** кнопка переходит в disabled-состояние с визуальным индикатором загрузки
   **And** touch target сохраняется `min-h-[48px]` (соблюдение NFR14)

## Tasks / Subtasks

- [ ] **Task 1: Установка Stripe SDK и настройка окружения** (AC: 1)
  - [ ] Subtask 1.1: Установить пакет `npm install stripe` (server-side SDK, последняя стабильная версия)
  - [ ] Subtask 1.2: Добавить в `.env.local` переменные:
    ```
    STRIPE_SECRET_KEY=sk_test_...
    STRIPE_MONTHLY_PRICE_ID=price_...
    STRIPE_QUARTERLY_PRICE_ID=price_...
    NEXT_PUBLIC_SITE_URL=http://localhost:3000
    ```
    ⚠️ `STRIPE_SECRET_KEY` — без префикса `NEXT_PUBLIC_`, иначе это критическая уязвимость безопасности
  - [ ] Subtask 1.3: Добавить те же ключи в `.env.example` с placeholder-значениями (без реальных ключей)
  - [ ] Subtask 1.4: Добавить в `next.config.mjs` переменную `NEXT_PUBLIC_SITE_URL` в `env` config (если требуется)

- [ ] **Task 2: Создание Stripe helper** (AC: 1)
  - [ ] Subtask 2.1: Создать `src/lib/stripe/index.ts` — инициализация Stripe-клиента:
    ```typescript
    import Stripe from 'stripe'

    export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-XX-XX', // использовать актуальную версию API из SDK
      typescript: true,
    })
    ```
    ⚠️ Этот файл ТОЛЬКО для серверного использования. Никогда не импортировать в `'use client'` компоненты.

- [ ] **Task 3: Создание Route Handler для Checkout** (AC: 1, 2, 3, 4, 5)
  - [ ] Subtask 3.1: Создать `src/app/api/checkout/route.ts`:
    - Метод: `POST`
    - Тело запроса: `{ plan: 'monthly' | 'quarterly' }`
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
  - [ ] Subtask 3.2: Убедиться, что файл НЕ имеет `'use client'` директивы (Route Handlers — серверный код)

- [ ] **Task 4: Обновление `PricingSection` — подключение Checkout** (AC: 1, 2, 5, 6)
  - [ ] Subtask 4.1: Обновить `src/features/landing/components/PricingSection.tsx`:
    - Добавить состояние: `const [isLoading, setIsLoading] = useState(false)`
    - Добавить состояние: `const [checkoutError, setCheckoutError] = useState<string | null>(null)`
    - Создать async handler `handleCheckout`:
      ```typescript
      async function handleCheckout() {
        setIsLoading(true)
        setCheckoutError(null)
        try {
          const res = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan: selected }),
          })
          const data = await res.json()
          if (!res.ok || !data.url) throw new Error(data.error || 'Неизвестная ошибка')
          window.location.href = data.url
        } catch {
          setCheckoutError('Не удалось начать оформление. Попробуйте снова.')
          setIsLoading(false)
        }
      }
      ```
    - Заменить `<Link href="/login">` на `<button>` с `onClick={handleCheckout}` и `disabled={isLoading}`
    - Кнопка в disabled-состоянии: визуальный индикатор (например, текст меняется на "Загрузка..." или spinner)
    - При наличии `checkoutError` — показать ошибку под кнопкой в виде inline-текста (не Toast, так как это в рамках формы)
  - [ ] Subtask 4.2: Сохранить все существующие классы кнопки + добавить `disabled:opacity-50 disabled:cursor-not-allowed`
  - [ ] Subtask 4.3: Проверить, что `min-h-[48px]` у кнопки не изменился (NFR14)

- [ ] **Task 5: Написание тестов** (AC: 1, 5)
  - [ ] Subtask 5.1: Создать `tests/unit/app/api/checkout/route.test.ts`:
    - Mock `stripe.checkout.sessions.create` через jest.mock/vi.mock
    - Тест: `POST { plan: 'monthly' }` → returns `{ url: 'https://checkout.stripe.com/...' }` со статусом 200
    - Тест: `POST { plan: 'quarterly' }` → использует `STRIPE_QUARTERLY_PRICE_ID`
    - Тест: `POST { plan: 'invalid' }` → returns 400
    - Тест: Stripe выбрасывает ошибку → returns 500
  - [ ] Subtask 5.2: Создать `tests/unit/features/landing/components/PricingSection.checkout.test.tsx`:
    - Mock `fetch` через `vi.fn()` или `jest.fn()`
    - Тест: клик на кнопку → кнопка переходит в disabled во время загрузки
    - Тест: успешный ответ `{ url: '...' }` → `window.location.href` установлен
    - Тест: ошибочный ответ → показывается inline-сообщение об ошибке
    - Тест: кнопка с `aria-disabled` или `disabled` атрибутом во время загрузки

## Dev Notes

### Критически важный контекст (предыдущие истории)

**Story 1.3 (done):** `PricingSection` уже реализован в `src/features/landing/components/PricingSection.tsx`.
- Использует `useState<Plan>('quarterly')` для выбора тарифа
- CTA кнопка сейчас: `<Link href="/login">Вступить сейчас</Link>` — **нужно заменить на `<button>`**
- Компонент уже `'use client'` — добавление `useState(isLoading)` не требует изменений директивы
- Не менять внешний вид кнопки — только поведение onClick

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
│   └── api/
│       └── checkout/
│           └── route.ts          # NEW — POST handler
├── lib/
│   └── stripe/
│       └── index.ts              # NEW — Stripe client singleton
└── features/
    └── landing/
        └── components/
            └── PricingSection.tsx # MODIFY — подключить checkout
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

Паттерн из architecture.md:
- **Системные ошибки** (сетевые, сбой Stripe API) → inline-сообщение об ошибке под кнопкой (не Toast, так как это пользовательское действие в рамках одного компонента)
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

### Completion Notes List

### File List
