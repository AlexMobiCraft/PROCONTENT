-- Migration: 005_add_past_due_unpaid_status.sql
-- Добавить 'past_due' и 'unpaid' в CHECK constraint subscription_status
-- Причина: эти статусы используются Stripe (просрочка, неоплата), но отсутствовали в constraint.
-- Миграция 004 добавила 'trialing'; данная миграция финализирует набор всех валидных статусов.

alter table public.profiles
  drop constraint if exists profiles_subscription_status_check;

alter table public.profiles
  add constraint profiles_subscription_status_check
  check (subscription_status in ('active', 'inactive', 'canceled', 'trialing', 'past_due', 'unpaid'));
