---
title: 'Fix: группировка медиа-альбомов Telegram без media_group_id'
type: 'bugfix'
created: '2026-04-27'
status: 'done'
route: 'one-shot'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Telegram Desktop не экспортирует поле `media_group_id` для альбомов (926 медиа-сообщений, 0 с `media_group_id`). Скрипт `telegram_migration.ts` создавал отдельный пост для каждого файла вместо одного gallery-поста.

**Approach:** Последовательные медиа-сообщения (фото или файл) без `media_group_id`, отправленные в течение `ALBUM_TIME_THRESHOLD_SECONDS = 5` секунд от первого в группе, объединяются в `gallery`. Путь через `media_group_id` сохранён для обратной совместимости с новыми форматами экспорта.

</frozen-after-approval>

## Suggested Review Order

1. [`scripts/telegram_migration.ts:63`](../../scripts/telegram_migration.ts) — константа `ALBUM_TIME_THRESHOLD_SECONDS` и хелпер `timeDiffSeconds`
2. [`scripts/telegram_migration.ts:110`](../../scripts/telegram_migration.ts) — новый `groupMessages`: сортировка `nonGrouped`, proximity-цикл, `chunk.length === 1` для postType
3. [`tests/unit/scripts/telegram_migration.test.ts:133`](../../tests/unit/scripts/telegram_migration.test.ts) — 6 новых тест-кейсов для proximity-группировки
