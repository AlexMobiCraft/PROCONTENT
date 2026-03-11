-- Migration: 002_add_subscription_fields.sql
-- Добавление полей подписки в таблицу profiles (Stripe + управление доступом)

alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text check (
    subscription_status in ('active', 'inactive', 'canceled')
  ),
  add column if not exists current_period_end timestamptz;

-- Индексы для быстрого поиска по Stripe ID (используются в webhook-обработчиках)
create index if not exists profiles_stripe_customer_id_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists profiles_stripe_subscription_id_idx
  on public.profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- RLS политика: пользователи могут читать только свою запись (для проверки доступа)
-- Уже создана в 001 (select policy), дополнительных изменений не требуется.

-- Сервисная роль (Service Role Key) обходит RLS автоматически — явные политики для
-- webhook не нужны. Документируем это намерение:
-- WEBHOOK использует SUPABASE_SERVICE_ROLE_KEY → обходит RLS → может писать в profiles.
