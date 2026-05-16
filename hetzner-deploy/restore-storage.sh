#!/bin/bash
# Восстановление Storage файлов из бэкапа в self-hosted Supabase
# Запуск: bash restore-storage.sh /path/to/backup/dir

set -e

BACKUP_DIR="${1:-./backups/20260516_062932}"
STORAGE_VOLUME="./volumes/storage"
DB_CONTAINER="supabase-db"
DB_USER="postgres"
DB_NAME="postgres"

echo "=== Восстановление Storage ProContent ==="
echo "Backup dir: $BACKUP_DIR"

# Проверка наличия Docker
if ! docker ps | grep -q "$DB_CONTAINER"; then
    echo "Ошибка: контейнер $DB_CONTAINER не запущен"
    exit 1
fi

# Проверка наличия storage в бэкапе
if [ ! -d "$BACKUP_DIR/storage" ]; then
    echo "Ошибка: папка storage не найдена в бэкапе: $BACKUP_DIR/storage"
    exit 1
fi

# 1. Создание bucket'ов в БД
echo ""
echo "--- Шаг 1: Создание buckets ---"
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" <<'SQL'
-- Создаем bucket post_media, если его нет
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('post_media', 'post_media', true, 52428800, null)
ON CONFLICT (id) DO NOTHING;

-- Создаем bucket inline_images, если его нет
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('inline_images', 'inline_images', true, 52428800, null)
ON CONFLICT (id) DO NOTHING;
SQL

# 2. Копирование файлов из бэкапа в volumes/storage/default/
echo ""
echo "--- Шаг 2: Копирование файлов в volumes/storage ---"
mkdir -p "$STORAGE_VOLUME/default"

# Копируем все содержимое storage из бэкапа
if [ -d "$BACKUP_DIR/storage/post_media" ]; then
    echo "Копирование post_media..."
    mkdir -p "$STORAGE_VOLUME/default/post_media"
    cp -r "$BACKUP_DIR/storage/post_media"/* "$STORAGE_VOLUME/default/post_media/" 2>/dev/null || true
fi

if [ -d "$BACKUP_DIR/storage/inline_images" ]; then
    echo "Копирование inline_images..."
    mkdir -p "$STORAGE_VOLUME/default/inline_images"
    cp -r "$BACKUP_DIR/storage/inline_images"/* "$STORAGE_VOLUME/default/inline_images/" 2>/dev/null || true
fi

# 3. Фикс прав доступа (chown для контейнера Supabase)
echo ""
echo "--- Шаг 3: Фикс прав доступа ---"
# В контейнере storage-api использует uid 1000 (обычно)
chown -R 1000:1000 "$STORAGE_VOLUME" 2>/dev/null || true
chmod -R 755 "$STORAGE_VOLUME" 2>/dev/null || true

# 4. Перезапуск storage контейнера для применения изменений
echo ""
echo "--- Шаг 4: Перезапуск storage ---"
docker compose restart storage 2>/dev/null || true

echo ""
echo "=== Восстановление Storage завершено ==="
echo ""
echo "Важно: Если файлы не отображаются в Studio, проверьте таблицу storage.objects."
echo "Можете синхронизировать через SQL или перезагрузить storage контейнер."
