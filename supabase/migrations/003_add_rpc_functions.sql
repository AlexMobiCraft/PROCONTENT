-- Migration: 003_add_rpc_functions.sql
-- Fix [AI-Review][Critical] Round 8: O(1) поиск пользователя в auth.users по email.
-- Заменяет auth.admin.listUsers() которая загружает всех пользователей в память
-- и не масштабируется при большом количестве пользователей.
-- Fix [AI-Review][Medium] Round 8: lower() обеспечивает case-insensitive сравнение email.

create or replace function public.get_auth_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

-- Отзываем доступ PUBLIC, оставляем только service_role (используется только в webhook)
revoke execute on function public.get_auth_user_id_by_email(text) from public;
grant execute on function public.get_auth_user_id_by_email(text) to service_role;
