---
title: 'Поднять лимит загрузки видео со 100 МБ до 300 МБ'
type: 'chore'
created: '2026-06-17'
status: 'done'
route: 'one-shot'
---

# Поднять лимит загрузки видео со 100 МБ до 300 МБ

## Intent

**Problem:** При создании поста видео ограничено 100 МБ; нужно разрешить до 300 МБ. Лимит размазан по цепочке: клиентская валидация → storage `FILE_SIZE_LIMIT` → host-nginx `client_max_body_size`, и расходование любого звена ломает загрузку непрозрачной ошибкой «Load failed» (413 без CORS).

**Approach:** Согласованно поднять все звенья до 300 МБ (`314572800 = 300×1024×1024`), nginx с запасом до `320m`. Дополнительно исправлен per-bucket `file_size_limit` в `restore-storage.sh` (был 50 МБ, имеет приоритет над глобальным) и добавлено предупреждение про лимит Cloudflare 100 МБ.

## Suggested Review Order

**Клиентская валидация (entry point)**

- Источник истины для лимита — клиент проверяет размер перед загрузкой в Storage.
  [`types.ts:216`](../../src/features/admin/types.ts#L216)

**Storage (self-hosted Supabase)**

- Глобальный лимит storage-контейнера; должен совпадать с клиентом.
  [`docker-compose.yml:247`](../../hetzner-deploy/docker-compose.yml#L247)

- Тот же лимит в official-варианте compose.
  [`docker-compose.official.yml:376`](../../hetzner-deploy/docker-compose.official.yml#L376)

- Per-bucket лимит `post_media` (приоритет над глобальным) — был 50 МБ, латентная мина при восстановлении.
  [`restore-storage.sh:37`](../../hetzner-deploy/restore-storage.sh#L37)

**Host-proxy и документация**

- `client_max_body_size` nginx с запасом (320 МБ) + предупреждение про Cloudflare.
  [`README.md:252`](../../hetzner-deploy/README.md#L252)
