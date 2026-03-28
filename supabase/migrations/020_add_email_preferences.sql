-- Story 3.5: Управление email-предпочтениями
-- Добавить поле email_notifications_enabled в profiles
-- DEFAULT true — все существующие участники продолжают получать письма

ALTER TABLE profiles
  ADD COLUMN email_notifications_enabled boolean DEFAULT true NOT NULL;
