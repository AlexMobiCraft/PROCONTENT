-- Migration: 036_add_user_profile_fields.sql
-- Добавление полей first_name и last_name в таблицу profiles

-- Добавить поля first_name и last_name
alter table public.profiles
  add column if not exists first_name text not null default '',
  add column if not exists last_name text;

-- Удалить default после добавления данных для новых пользователей
alter table public.profiles
  alter column first_name drop default;

-- Обновить триггер handle_new_user для инициализации first_name и last_name
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (new.id, new.email, '', null)
  on conflict (id) do update
  set email = excluded.email,
      first_name = coalesce(excluded.first_name, profiles.first_name),
      last_name = coalesce(excluded.last_name, profiles.last_name);
  return new;
end;
$$;
