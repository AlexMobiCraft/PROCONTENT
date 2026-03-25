-- Migration: Add Full Text Search to posts
-- Story: 2.7 Поиск по всей базе знаний
-- Используем словарь 'simple' т.к. контент на словенском языке (sl-SI),
-- для которого нет встроенного словаря в PostgreSQL.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS fts tsvector
    GENERATED ALWAYS AS (
      to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(excerpt, '') || ' ' || coalesce(content, ''))
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_posts_fts ON public.posts USING GIN(fts);
