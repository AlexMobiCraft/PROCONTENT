# Переход с test на live Stripe-аккаунт

**Применимо:** только для смены Stripe-аккаунта, Supabase не меняется.

## Шаги

### 1. Получить ключи от live-аккаунта Stripe

В Stripe Dashboard владельца:
- Переключить вверху слева на **Live** (не Test)
- **Developers → API keys** → скопировать:
  - `STRIPE_SECRET_KEY` → начинается с `sk_live_` (было `sk_test_`)

### 2. Создать webhook endpoint

**Developers → Webhooks → Add endpoint:**
- URL: `https://домен.com/api/webhooks/stripe`
- События (выбрать):
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- После создания → скопировать `STRIPE_WEBHOOK_SECRET` (начинается с `whsec_`)

### 3. Скопировать live цены продуктов

**Products → Products → выбрать продукт → раздел Pricing:**
- Найти каждый прайс ID (начинается с `price_`)
- `STRIPE_MONTHLY_PRICE_ID`
- `STRIPE_QUARTERLY_PRICE_ID`

### 4. Обновить переменные окружения

**Локально** в `.env.local`:
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_MONTHLY_PRICE_ID=price_...
STRIPE_QUARTERLY_PRICE_ID=price_...
```

**На хостинге** (Vercel, если используется):
- Settings → Environment Variables → обновить эти 4 переменные
- Передеплоить проект

### 5. Синхронизировать существующих клиентов

После смены ключей запустить скрипт:
```bash
npm install -D tsx dotenv  # если не установлены
npx tsx scripts/sync-stripe-subscriptions.ts --dry-run  # проверка
npx tsx scripts/sync-stripe-subscriptions.ts            # применить
```

Скрипт автоматически:
- Получит все активные подписки из live-Stripe
- Найдёт профили в Supabase по email
- Обновит `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `current_period_end`

**Что делать с "не найденными"** (клиенты в Stripe, но не в БД):
- Если email отличается → обновить вручную через Supabase SQL Editor или скрипт

**Результат:** все 29 клиентов будут привязаны к их Stripe-подпискам в БД.
