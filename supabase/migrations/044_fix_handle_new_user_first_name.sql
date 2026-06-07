-- Migration: 044_fix_handle_new_user_first_name.sql
-- Исправление триггера handle_new_user.
--
-- Проблема: миграция 036 добавила на profiles.first_name constraints
--   (NOT NULL, first_name <> '', char_length(trim(first_name)) >= 3),
-- но при этом триггер handle_new_user продолжал вставлять first_name = ''.
-- В результате ЛЮБОЕ создание пользователя (обычная регистрация на сайте и
-- создание через Admin API) падало с ошибкой:
--   "Database error creating new user" / check constraint check_first_name_min_length.
--
-- Решение: триггер берёт first_name / last_name из user_metadata
-- (raw_user_meta_data), а при их отсутствии генерирует валидное значение
-- из локальной части email — та же логика бэкофилла, что в миграции 036.
-- Гарантируется минимум 3 символа (иначе fallback 'User').

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  meta_first text := nullif(trim(new.raw_user_meta_data ->> 'first_name'), '');
  meta_last  text := nullif(trim(new.raw_user_meta_data ->> 'last_name'), '');
  derived_first text;
begin
  -- 1) Имя из метаданных, иначе локальная часть email, иначе 'User'
  derived_first := coalesce(
    meta_first,
    nullif(trim(substring(new.email from 1 for position('@' in new.email) - 1)), ''),
    'User'
  );

  -- 2) Гарантируем минимум 3 символа (constraint check_first_name_min_length)
  if char_length(trim(derived_first)) < 3 then
    derived_first := 'User';
  end if;

  insert into public.profiles (id, email, first_name, last_name)
  values (new.id, new.email, derived_first, meta_last)
  on conflict (id) do nothing;

  return new;
end;
$$;
