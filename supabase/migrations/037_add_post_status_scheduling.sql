-- Migration: 037_add_post_status_scheduling.sql
-- Story 6.1: Схема БД — статусная модель постов

alter table public.posts
  add column if not exists status text,
  add column if not exists scheduled_at timestamptz,
  add column if not exists published_at timestamptz;

update public.posts
set status = 'published'
where status is null;

update public.posts
set published_at = coalesce(published_at, created_at)
where status = 'published'
  and published_at is null;

alter table public.posts
  alter column status set default 'draft';

update public.posts
set status = 'draft'
where status is null;

alter table public.posts
  alter column status set not null;

alter table public.posts
  drop constraint if exists posts_status_check;

alter table public.posts
  add constraint posts_status_check
    check (status in ('draft', 'scheduled', 'published'));

create index if not exists idx_posts_scheduled
  on public.posts (scheduled_at)
  where status = 'scheduled';
