-- Migration: 032_add_telegram_message_id.sql
-- Story 5.1: Telegram Migration — идемпотентность через telegram_message_id
-- Поле nullable: посты созданные вручную не имеют telegram_message_id

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT;

-- UNIQUE constraint: запрещает дублирование импортированных сообщений
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_telegram_message_id_unique;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_telegram_message_id_unique
  UNIQUE (telegram_message_id);

-- Частичный индекс: только для не-null значений (не тратим место на NULL-строки)
CREATE INDEX IF NOT EXISTS idx_posts_telegram_message_id
  ON public.posts(telegram_message_id)
  WHERE telegram_message_id IS NOT NULL;
