-- Migration: 004_fix_subscription_status_check.sql
-- Добавить 'trialing' в CHECK constraint subscription_status
-- Причина: webhook и middleware используют 'trialing', но старый constraint его не разрешает

alter table public.profiles
  drop constraint if exists profiles_subscription_status_check;

alter table public.profiles
  add constraint profiles_subscription_status_check
  check (subscription_status in ('active', 'inactive', 'canceled', 'trialing'));
