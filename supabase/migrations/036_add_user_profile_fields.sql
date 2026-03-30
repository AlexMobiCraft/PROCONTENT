-- Migration: 036_add_user_profile_fields.sql
-- Добавление полей first_name и last_name в таблицу profiles

-- Добавить поля first_name и last_name
alter table public.profiles
  add column if not exists first_name text not null default '',
  add column if not exists last_name text;

-- Удалить default после добавления данных для новых пользователей
alter table public.profiles
  alter column first_name drop default;

-- Fix #7: CHECK constraints — server-side enforcement длины имён
alter table public.profiles
  add constraint check_first_name_not_empty
    check (first_name <> ''),
  add constraint check_first_name_min_length
    check (char_length(trim(first_name)) >= 3),
  add constraint check_first_name_max_length
    check (char_length(first_name) <= 100),
  add constraint check_last_name_max_length
    check (last_name is null or char_length(last_name) <= 100);

-- Fix #2: Обновить триггер handle_new_user — ON CONFLICT DO NOTHING
-- чтобы повторные auth-события не перезаписывали first_name пустой строкой
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (new.id, new.email, '', null)
  on conflict (id) do nothing;
  return new;
end;
$$;
