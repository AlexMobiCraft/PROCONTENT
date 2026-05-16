#!/bin/bash
# Восстановление базы данных ProContent из бэкапа
# Запуск: bash restore-db.sh /path/to/backup/dir

set -e

BACKUP_DIR="${1:-./backups/20260516_062932}"
PROJECT_MIGRATIONS="${2:-../supabase/migrations}"
DB_CONTAINER="supabase-db"
DB_USER="postgres"
DB_NAME="postgres"

echo "=== Восстановление БД ProContent ==="
echo "Backup dir: $BACKUP_DIR"
echo "Migrations dir: $PROJECT_MIGRATIONS"

# Проверка наличия Docker
if ! docker ps | grep -q "$DB_CONTAINER"; then
    echo "Ошибка: контейнер $DB_CONTAINER не запущен"
    echo "Сначала запустите: docker compose up -d"
    exit 1
fi

# Функция для выполнения SQL в БД
psql_exec() {
    docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -q
}

# 1. Применение миграций проекта
echo ""
echo "--- Шаг 1: Применение миграций проекта ---"
if [ -d "$PROJECT_MIGRATIONS" ]; then
    for f in $(ls "$PROJECT_MIGRATIONS"/*.sql | sort); do
        echo "Applying: $(basename $f)"
        cat "$f" | psql_exec
    done
else
    echo "Предупреждение: папка с миграциями не найдена: $PROJECT_MIGRATIONS"
fi

# 2. Очистка таблиц перед загрузкой данных (чтобы избежать дубликатов)
echo ""
echo "--- Шаг 2: Очистка таблиц ---"
cat <<'SQL' | psql_exec
-- Отключаем проверки FK для TRUNCATE
SET session_replication_role = replica;

-- Очистка в правильном порядке (зависимые таблицы сначала)
TRUNCATE TABLE public.post_likes CASCADE;
TRUNCATE TABLE public.post_comments CASCADE;
TRUNCATE TABLE public.post_media CASCADE;
TRUNCATE TABLE public.posts CASCADE;
TRUNCATE TABLE public.profiles CASCADE;
TRUNCATE TABLE public.categories CASCADE;
TRUNCATE TABLE public.site_settings CASCADE;

-- Включаем проверки обратно
SET session_replication_role = DEFAULT;
SQL

# 3. Загрузка данных из SQL дампов
echo ""
echo "--- Шаг 3: Загрузка данных из бэкапа ---"

TABLES=(
    "categories"
    "profiles"
    "posts"
    "post_media"
    "post_likes"
    "post_comments"
    "site_settings"
)

for table in "${TABLES[@]}"; do
    SQL_FILE="$BACKUP_DIR/${table}.sql"
    if [ -f "$SQL_FILE" ] && [ -s "$SQL_FILE" ]; then
        echo "Loading: $table.sql"
        cat "$SQL_FILE" | psql_exec
    else
        echo "Skipping: $table.sql (not found or empty)"
    fi
done

# 4. Обновление sequence (если есть)
echo ""
echo "--- Шаг 4: Обновление sequence ---"
cat <<'SQL' | psql_exec
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT c.relname as table_name, a.attname as column_name
        FROM pg_class c
        JOIN pg_attribute a ON a.attrelid = c.oid
        JOIN pg_type t ON a.atttypid = t.oid
        WHERE c.relnamespace = 'public'::regnamespace
        AND t.typname = 'int4'
        AND EXISTS (
            SELECT 1 FROM pg_class s
            JOIN pg_depend d ON d.objid = s.oid
            WHERE s.relkind = 'S'
            AND d.refobjid = c.oid
            AND d.refobjsubid = a.attnum
        )
    LOOP
        EXECUTE format('SELECT setval(pg_get_serial_sequence(%L, %L), COALESCE(MAX(%I), 1)) FROM %I', 
            r.table_name, r.column_name, r.column_name, r.table_name);
    END LOOP;
END $$;
SQL

echo ""
echo "=== Восстановление БД завершено ==="
