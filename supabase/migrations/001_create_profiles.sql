-- Migration: 001_create_profiles.sql
-- Создание таблицы профилей пользователей с RLS и trigger

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz default now() not null
);

-- Включить Row Level Security
alter table public.profiles enable row level security;

-- Политика: пользователи видят только свой профиль
create policy "Пользователи видят только свой профиль"
  on public.profiles for select
  using (auth.uid() = id);

-- Политика: пользователи обновляют только свой профиль
create policy "Пользователи обновляют только свой профиль"
  on public.profiles for update
  using (auth.uid() = id);

-- Функция: автоматически создаёт профиль при регистрации
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

-- Trigger: вызывает handle_new_user при создании пользователя
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
