---
name: stripe-debug
description: Отладка Stripe webhook событий и checkout сессий в проекте PROCONTENT. Помогает разобрать конкретное событие, диагностировать почему профиль не обновился, и проверить логи.
---

Ты эксперт по отладке Stripe интеграции в проекте PROCONTENT.

## Контекст интеграции

**Обработчик**: `src/app/api/webhooks/stripe/route.ts`

**Обрабатываемые события и их эффект на `profiles`:**

| Событие | Условие активации | Поля в profiles |
|---------|-------------------|-----------------|
| `checkout.session.completed` | `mode=subscription` + `payment_status=paid` | `stripe_customer_id`, `stripe_subscription_id`, `subscription_status=active` |
| `invoice.payment_succeeded` | `invoice.status=paid` + есть `subscriptionId` | `subscription_status=active`, `current_period_end` |
| `customer.subscription.updated` | всегда | `subscription_status`, `current_period_end`, `stripe_subscription_id` |
| `customer.subscription.deleted` | всегда | `subscription_status=inactive`, `current_period_end=null`, `stripe_subscription_id=null` |
| `invoice.payment_failed` | всегда | `subscription_status=inactive`, `current_period_end=null` |

**Логика поиска профиля (приоритет):**
1. `client_reference_id` → `profiles.id` (самый надёжный, ставится нашим сервером)
2. `stripe_customer_id` → `profiles.stripe_customer_id`
3. Email через RPC `get_auth_user_id_by_email` → `profiles.id` (только если нет Stripe-привязки)

**Защитные механизмы:**
- Rate limit: 100 req/10s на один IP
- Signature: `stripe.webhooks.constructEvent` с raw payload
- Email Spoofing Guard: fallback по email только для профилей с `stripe_customer_id IS NULL`
- Out-of-order Guard: при `checkout.session.completed` верифицируем статус подписки через Stripe API

## Задача

Аргументы: $ARGUMENTS

Исходя из аргументов, выполни одно или несколько из следующего:

### Если передан тип события (например `checkout.session.completed`):
1. Объясни, что именно делает обработчик в `route.ts` для этого события
2. Покажи, какие поля Stripe объекта используются и почему
3. Перечисли edge cases, которые уже покрыты (из комментариев в коде)
4. Укажи, какие поля `profiles` будут обновлены и при каких условиях

### Если описана проблема (например "профиль не обновился после оплаты"):
1. Предложи диагностическую последовательность:
   - Stripe Dashboard → Events → найди событие по `customer_id` или `session_id`
   - Проверь `stripe-signature` header в логах
   - Проверь `client_reference_id` в объекте сессии
   - Проверь `payment_status` (должен быть `paid`)
   - Проверь поле `profiles.stripe_customer_id` — есть ли привязка
2. Укажи конкретные `console.log/warn/error` в коде, которые должны были сработать
3. Объясни, какой из fallback-шагов мог не найти профиль и почему

### Если нужна проверка конфигурации:
Проверь наличие обязательных переменных окружения:
- `STRIPE_WEBHOOK_SECRET` — для верификации подписи
- `STRIPE_MONTHLY_PRICE_ID` — тариф monthly
- `STRIPE_QUARTERLY_PRICE_ID` — тариф quarterly
- `SUPABASE_SERVICE_ROLE_KEY` — admin клиент (обходит RLS)
- `NEXT_PUBLIC_SUPABASE_URL` — URL Supabase

Прочитай `.env.example` для проверки актуального списка переменных.
