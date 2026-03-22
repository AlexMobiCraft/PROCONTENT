# Brief: Architect - Рефакторинг модели данных ленты (Multi-media)

## Контекст
Текущая схема БД (`posts.image_url`, `posts.type`) денормализована и не масштабируется для галерей. Необходимо нормализовать данные, выделив медиа-файлы в отдельную связанную сущность.

## Задачи для выполнения

1. **Проектирование схемы БД (Supabase)**:
    - Разработать таблицу `post_media`:
        - `id`: UUID (Primary Key)
        - `post_id`: UUID (FK to `posts.id`, CASCADE ON DELETE)
        - `media_type`: ENUM ('image', 'video')
        - `url`: TEXT (CDN link)
        - `thumbnail_url`: TEXT (для видео)
        - `order_index`: INTEGER (для сохранения порядка)
    - Подготовить SQL-скрипт миграции с переносом существующих `image_url` из старой таблицы.

2. **Обновление Архитектуры (`_bmad-output/planning-artifacts/architecture.md`)**:
    - Обновить раздел **Domain Model** и **Database Schema**.
    - Описать новый паттерн взаимодействия фронтенда с API: `Post` теперь включает в себя `media[]`.

3. **Типизация (Frontend)**:
    - Обновить `src/features/feed/types.ts`:
        - Интерфейс `PostMedia`.
        - Обновление интерфейсов `PostCardData` и `PostDetail`.

## Ожидаемый результат
Готовый набор SQL-миграций и обновленные архитектурные документы, гарантирующие целостность данных после рефакторинга.
