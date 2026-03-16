-- Migration: 006_add_incomplete_paused_status.sql
-- Добавить 'incomplete', 'incomplete_expired', 'paused' в CHECK constraint subscription_status
-- Причина: эти статусы используются Stripe; их отсутствие вызывало constraint violation
-- при вебхуках с этими статусами → рассинхронизация Stripe и БД.
-- Финализирует полный набор всех возможных статусов Stripe subscription.

alter table public.profiles
  drop constraint if exists profiles_subscription_status_check;

alter table public.profiles
  add constraint profiles_subscription_status_check
  check (subscription_status in (
    'active',
    'inactive',
    'canceled',
    'trialing',
    'past_due',
    'unpaid',
    'incomplete',
    'incomplete_expired',
    'paused'
  ));
