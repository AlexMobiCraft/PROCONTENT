---
title: "Product Brief Distillate: Отложенная публикация постов"
type: llm-distillate
source: "product-brief-scheduled-publishing.md"
created: "2026-04-01"
purpose: "Token-efficient context for downstream PRD creation"
project: "PROCONTENT"
---

# Detail Pack: Отложенная публикация постов

## Суть фичи (одной строкой)
Добавить к форме создания поста datetime picker; пост сохраняется со статусом `scheduled` и публикуется автоматически cron-задачей; при публикации — стандартная email-рассылка участникам.

---

## Технический контекст проекта

- **Stack:** Next.js 16 (App Router) + Supabase (Postgres + Auth + Storage) + Vercel
- **Существующий паттерн для webhooks/cron:** Route Handlers в `/api/` (пример: `/api/webhooks/stripe`)
- **Email-рассылка:** уже реализована через Resend + `resend.batch.send()`, batch по 100 писем — Story 3.4
- **Текущий триггер email:** Supabase Database Webhook на INSERT в таблицу `posts` → `POST /api/notifications/new-post`
- **Для scheduled:** триггер нужно переключить на UPDATE (когда `status` меняется на `'published'`); или вызывать endpoint вручную из cron Route Handler
- **Нет существующей cron-инфраструктуры** — нужно добавить с нуля

---

## Модель данных (требования к изменениям)

**Добавить в таблицу `posts`:**
```sql
status        TEXT NOT NULL DEFAULT 'draft'   -- 'draft' | 'scheduled' | 'published'
scheduled_at  TIMESTAMPTZ                     -- UTC, когда публиковать
published_at  TIMESTAMPTZ                     -- UTC, фактический момент публикации (для идемпотентности)
```

**Индекс:**
```sql
CREATE INDEX idx_posts_scheduled ON posts (status, scheduled_at)
  WHERE status = 'scheduled';
```

**Идемпотентность:** `published_at IS NOT NULL` означает "уже опубликован" → не дублировать email при ретрае.

**Атомарность:** UPDATE с `WHERE status = 'scheduled' AND scheduled_at <= now() RETURNING id` — PostgreSQL гарантирует атомарность, дублей не будет при параллельных cron-вызовах.

---

## Выбранный технический подход

**Vercel Cron Jobs** (приоритет над pg_cron):
- Причина: вписывается в существующий паттерн Route Handlers, знакомый стек
- Файл: `src/app/api/cron/publish-scheduled/route.ts`
- Конфиг: `vercel.json` → `"crons": [{"path": "/api/cron/publish-scheduled", "schedule": "*/5 * * * *"}]`
- Защита endpoint: `Authorization: Bearer ${CRON_SECRET}` (env var)
- Точность: ±5 минут — достаточно, пользователь подтвердил

**Vercel план:** не уточнялся. Hobby = 1 cron/день (не подходит), Pro = каждую минуту. Если Hobby — нужен pg_cron как альтернатива.

---

## Требования к UI

**Форма создания/редактирования поста (Story 4.1 расширение):**
- Toggle "Опубликовать сейчас / Запланировать"
- DateTime picker при выборе "Запланировать"
- Явное отображение timezone (браузерная timezone пользователя — CET/CEST для Словении)
- Validation: `scheduled_at` должен быть в будущем
- Preview: "Пост будет опубликован [дата] в [время] [timezone]"

**Admin-панель — раздел "Запланировано":**
- Компонент: **таблица** (не календарь)
- Колонки: заголовок поста, дата и время публикации, статус, кнопка "Отменить"
- Отмена = смена статуса `scheduled` → `draft`

---

## Отклонённые идеи (не предлагать повторно)

| Идея | Причина отклонения |
|---|---|
| Email-анонс за 24 часа до публикации | Явный отказ пользователя; "стандартная рассылка как для остальных постов" |
| Автопост в Telegram при публикации | Явный отказ; несмотря на наличие Telegram-бота (Story 5.1) |
| Drag-and-drop календарь в admin | Слишком трудоёмко для MVP; список-таблица — достаточно |
| Recurring/повторяющиеся публикации | Вне скоупа MVP |
| pg_cron как первичный подход | Предпочтение Vercel Cron (знакомый паттерн); pg_cron как fallback если Hobby план |

---

## Edge Cases, которые нужно обработать

1. **Missed jobs** — cron не сработал при downtime: `scheduled_at <= now()` подтягивает все пропущенные посты при следующем запуске
2. **Дублирование email** — при ретрае: проверять `published_at IS NOT NULL` перед отправкой
3. **Timezone в UI** — хранить `scheduled_at` в UTC, отображать в браузерной timezone; учесть переход на летнее время (Словения: CET/CEST, UTC+1/UTC+2)
4. **Race condition** — два параллельных cron-запроса: атомарный UPDATE + RETURNING решает проблему
5. **Редактирование в момент публикации** — если cron сработал пока открыта форма редактирования: `published_at` будет проставлен, форма должна заблокироваться/перезагрузиться
6. **Vercel timeout** — функция 10–60 сек; если много постов к публикации одновременно — батчевая обработка или `next/after`

---

## Что не определено (открытые вопросы для PRD)

- Vercel план проекта (Hobby vs Pro) → влияет на выбор Vercel Cron vs pg_cron
- Нужно ли уведомление создателю при успешной автопубликации? (пока нет, но логично)
- Что показывать в ленте для самого admin при просмотре scheduled-постов? (draft-превью или скрыто?)
- Порядок публикации если несколько постов запланированы на одно время

---

## Скоуп MVP (финальный)

**В MVP:**
- `scheduled` статус в модели постов
- datetime picker с timezone в форме создания/редактирования
- Vercel Cron каждые 5 минут → Route Handler → обновление статуса
- Стандартная email-рассылка в момент автопубликации
- Таблица запланированных постов в admin-панели (просмотр + отмена)
- Редактирование запланированного поста (включая смену времени)

**Не в MVP:**
- Календарный вид
- Анонс за 24 часа
- Telegram-интеграция
- Recurring публикации
- Аналитика времени публикации
- Уведомление автору о факте публикации
