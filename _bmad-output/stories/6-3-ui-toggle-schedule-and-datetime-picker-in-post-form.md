# Story 6.3: UI — Toggle «Запланировать» + datetime picker в форме поста

Status: ready-for-dev

## Story

As a автор,
I want переключиться в режим «Запланировать» в форме создания/редактирования поста и выбрать дату и время,
so that пост сохраняется со статусом `scheduled` и появится в ленте автоматически в назначенное время.

## Acceptance Criteria

1. **Toggle «Опубликовать сейчас» / «Запланировать»:**
   - В форме создания/редактирования поста (`PostForm`) отображается toggle с двумя состояниями: «Objavi zdaj» (по умолчанию) и «Načrtuj objavo»
   - Toggle имеет `aria-pressed`, `min-h-[44px] min-w-[44px]` (UX-DR1, UX-DR2)
   - Полная keyboard navigation (WCAG 2.1 AA, UX-DR3)

2. **Datetime picker (при «Запланировать»):**
   - При переключении в «Načrtuj objavo» появляется `<input type="datetime-local">` с `aria-label` и `aria-describedby`
   - Под полем — preview-текст: «Objava bo objavljena [дата] ob [время] ([timezone])» через `Intl.DateTimeFormat` (FR6.3)
   - Touch target `min-h-[44px]` (UX-DR1)

3. **Валидация:**
   - Время в прошлом или пустое поле при режиме «Запланировать» → inline error под полем: «Izberite čas v prihodnosti» (FR6.4, UX-DR4)
   - Toast НЕ используется для ошибок валидации

4. **Сохранение scheduled поста:**
   - При «Запланировать» + валидное будущее время → пост сохраняется со `status='scheduled'`, `scheduled_at` в UTC, `is_published=false` (FR6.5)
   - Пост НЕ появляется в ленте участников

5. **Immediate publish (по умолчанию):**
   - При «Опубликовать сейчас» → текущее поведение сохраняется: `status='published'`, `published_at=now()`, `is_published=true`

6. **Редактирование scheduled поста:**
   - При загрузке формы для `scheduled` поста: toggle = «Запланировать», datetime picker показывает текущее `scheduled_at` в локальной timezone
   - Изменение `scheduled_at` → обновляется в БД (FR6.7)

7. **Отмена расписания:**
   - Переключение toggle обратно на «Опубликовать сейчас» и сохранение → `status='draft'`, `scheduled_at=null` (FR6.8)

8. **Немедленная публикация scheduled поста:**
   - Автор может переключить toggle на «Опубликовать сейчас» и сохранить → `status='published'`, `published_at=now()`, `scheduled_at=null`, `is_published=true` (FR6.9)

## Tasks / Subtasks

- [ ] Task 1: Расширить Zod-схему и типы (AC: 1, 2, 3)
  - [ ] 1.1 Добавить `status` и `scheduled_at` в `PostFormSchema` (`src/features/admin/types.ts`)
  - [ ] 1.2 `status`: `z.enum(['draft', 'scheduled', 'published']).default('published')` — НЕ optional, дефолт `published`
  - [ ] 1.3 `scheduled_at`: `z.string().nullable().optional()` — ISO datetime string
  - [ ] 1.4 Добавить кросс-валидацию через `.superRefine()`: если `status === 'scheduled'` → `scheduled_at` обязательно + в будущем

- [ ] Task 2: Обновить `createPost()` и `updatePost()` в API (AC: 4, 5, 6, 7, 8)
  - [ ] 2.1 `createPost()` — принять `status` и `scheduled_at` из формы
  - [ ] 2.2 При `status='scheduled'`: INSERT с `is_published: false`, `status: 'scheduled'`, `scheduled_at`, `published_at: null`
  - [ ] 2.3 При `status='published'` (immediate): текущее поведение без изменений (`is_published: true`, `published_at` после медиа)
  - [ ] 2.4 `updatePost()` — поддержать обновление `status` и `scheduled_at`
  - [ ] 2.5 При смене `scheduled → published` (немедленная публикация): `is_published=true`, `published_at=now()`, `scheduled_at=null`; запустить email-уведомление через `POST /api/notifications/new-post`
  - [ ] 2.6 При смене `published → scheduled` (перепланирование уже опубликованного): **ЗАПРЕТИТЬ** — пост с `published_at IS NOT NULL` нельзя вернуть в `scheduled`
  - [ ] 2.7 При смене `scheduled → draft` (отмена): `is_published=false`, `scheduled_at=null`, `published_at=null`

- [ ] Task 3: Добавить UI toggle + datetime picker в PostForm (AC: 1, 2, 3, 6, 7, 8)
  - [ ] 3.1 Создать секцию «Режим публикации» в PostForm между секцией curation toggles и кнопкой submit
  - [ ] 3.2 Toggle: два `<button>` с `aria-pressed`, визуально объединённые в segmented control (не checkbox/switch). Текст кнопок: `font-sans text-xs font-medium tracking-[0.2em] uppercase` (editorial style per UX spec)
  - [ ] 3.3 Активное состояние toggle: `bg-primary text-primary-foreground`. Неактивное: `bg-transparent hover:bg-primary/10`. Focus: `focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none`. Transition: `transition-colors` (UX-DR9)
  - [ ] 3.4 Conditional rendering: `<input type="datetime-local">` при `status === 'scheduled'`
  - [ ] 3.5 Preview текст: `text-xs text-muted-foreground tracking-[0.1em]` через `Intl.DateTimeFormat('sl-SI', { dateStyle: 'long', timeStyle: 'short', timeZone: ... })` + timezone abbr
  - [ ] 3.6 Inline error: `errors.scheduled_at && <p className="text-destructive text-sm" role="alert">{message}</p>`. При ошибке datetime input получает `border-destructive aria-invalid="true"`
  - [ ] 3.7 При edit mode — предзаполнить toggle и datetime из `initialData.status` и `initialData.scheduled_at`
  - [ ] 3.8 Текст кнопки submit: «Objavi» при immediate, «Načrtuj» при scheduled. Стиль кнопки — текущий editorial outline (`border border-primary font-sans text-xs font-medium tracking-[0.2em] uppercase`), меняется только текст

- [ ] Task 4: Написать тесты (AC: 1–8)
  - [ ] 4.1 PostForm: toggle видим, переключается, datetime picker появляется/скрывается
  - [ ] 4.2 PostForm: inline error при пустом datetime в режиме scheduled
  - [ ] 4.3 PostForm: submit вызывает createPost со `status='scheduled'` и `scheduled_at`
  - [ ] 4.4 PostForm: edit mode pre-fills toggle и datetime для scheduled поста
  - [ ] 4.5 API: createPost с `status='scheduled'` → INSERT с `is_published=false`
  - [ ] 4.6 API: updatePost `scheduled → published` → `is_published=true`, email notification triggered
  - [ ] 4.7 API: updatePost `scheduled → draft` → `scheduled_at=null`
  - [ ] 4.8 Zod: валидация отклоняет `status='scheduled'` без `scheduled_at`
  - [ ] 4.9 Zod: валидация отклоняет `scheduled_at` в прошлом при `status='scheduled'`

## Dev Notes

### Обязательная предварительная зависимость

**Story 6.1 и 6.2 ДОЛЖНЫ быть выполнены до этой story.** Поля `status`, `scheduled_at`, `published_at` в таблице `posts` созданы в Story 6.1. Cron endpoint для автопубликации реализован в Story 6.2. Убедись, что миграции 037 и 038 применены до начала разработки.

### Существующая форма PostForm — РАСШИРЯЙ, НЕ ПЕРЕПИСЫВАЙ

`src/features/admin/components/PostForm.tsx` — production-ready форма с react-hook-form + Zod, drag-and-drop медиа, curation toggles, rollback-механизмом. **Добавляй** scheduling секцию, **не трогай** существующую логику.

Текущая структура PostForm (порядок секций):
1. Title input
2. Category select
3. Excerpt textarea
4. Content textarea (TipTap/markdown)
5. MediaUploader (drag-and-drop, до 10 файлов)
6. Curation toggles (is_landing_preview, is_onboarding)
7. **← ЗДЕСЬ добавить scheduling section**
8. Submit button

### Типы PostForm — что уже есть

`InitialData` (PostForm props) уже содержит `status?: 'draft' | 'scheduled' | 'published'` и `scheduled_at?: string | null` (добавлено в Story 6.1). Форма загружает эти значения при edit, но пока НЕ рендерит в UI.

`PostFormSchema` в `src/features/admin/types.ts` пока НЕ содержит `status` и `scheduled_at` — нужно добавить.

### API posts.ts — текущий контракт

`createPost()` уже явно записывает `status: 'published'`, `scheduled_at: null`, `published_at: null` (published_at выставляется отдельно после загрузки медиа).

`updatePost()` снапшотит `status`, `scheduled_at`, `published_at` для rollback, но НЕ обновляет эти поля из формы.

`fetchPostForEdit()` уже возвращает `status`, `scheduled_at`, `published_at`.

### Datetime picker — нативный `<input type="datetime-local">`

**НЕ устанавливать сторонние библиотеки** (react-day-picker, date-fns и т.д.). Использовать нативный `<input type="datetime-local">` (UX-DR7):
- iOS Safari: нативный полноэкранный picker
- Android Chrome: нативный datepicker
- Desktop: inline date/time inputs

Паттерн:
```typescript
<input
  type="datetime-local"
  className={cn(
    'min-h-[44px] min-w-[44px] rounded-lg border px-3 py-2',
    'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
    errors.scheduled_at ? 'border-destructive' : 'border-border'
  )}
  aria-label="Datum in čas objave"
  aria-describedby="schedule-preview"
  aria-invalid={!!errors.scheduled_at}
  min={getMinDatetime()} // текущее время + 5 минут
  value={localDatetime}
  onChange={(e) => setValue('scheduled_at', toUTC(e.target.value))}
/>
{errors.scheduled_at && (
  <p className="text-destructive text-sm" role="alert">
    {errors.scheduled_at.message}
  </p>
)}
```

Конвертация UTC ↔ local datetime-local:
```typescript
// UTC ISO → datetime-local string для input value
function toLocalDatetimeString(utcIso: string): string {
  const d = new Date(utcIso)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16) // "YYYY-MM-DDTHH:MM"
}

// datetime-local string → UTC ISO для отправки в БД
function toUTCISOString(localStr: string): string {
  return new Date(localStr).toISOString()
}
```

### Timezone preview — Intl.DateTimeFormat

```typescript
function formatSchedulePreview(utcIso: string): string {
  const date = new Date(utcIso)
  const formatted = new Intl.DateTimeFormat('sl-SI', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date)

  // Получить аббревиатуру timezone (CET/CEST)
  const tzAbbr = new Intl.DateTimeFormat('sl-SI', {
    timeZoneName: 'short',
  }).formatToParts(date).find(p => p.type === 'timeZoneName')?.value ?? ''

  return `Objava bo objavljena ${formatted} (${tzAbbr})`
}

// В JSX: <p id="schedule-preview" className="text-xs text-muted-foreground tracking-[0.1em]">{preview}</p>
```

### Toggle — segmented control, НЕ switch/checkbox

Toggle реализуется как два `<button>` в контейнере с rounded corners и border:

```tsx
<div className="flex rounded-lg border" role="group" aria-label="Način objave">
  <button
    type="button"
    className={cn(
      'flex-1 min-h-[44px] px-4 rounded-l-lg font-sans text-xs font-medium tracking-[0.2em] uppercase transition-colors',
      'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
      isImmediate ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-primary/10'
    )}
    aria-pressed={isImmediate}
    onClick={() => handleModeChange('published')}
  >
    Objavi zdaj
  </button>
  <button
    type="button"
    className={cn(
      'flex-1 min-h-[44px] px-4 rounded-r-lg font-sans text-xs font-medium tracking-[0.2em] uppercase transition-colors',
      'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
      isScheduled ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-primary/10'
    )}
    aria-pressed={isScheduled}
    onClick={() => handleModeChange('scheduled')}
  >
    Načrtuj objavo
  </button>
</div>
```

### Email при немедленной публикации scheduled поста (Task 2.5)

Когда автор переключает scheduled пост на «Опубликовать сейчас» и сохраняет, нужно запустить email-уведомление. Переиспользуй существующий endpoint:

```typescript
// В updatePost(), после успешного UPDATE с status='published':
await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/notifications/new-post`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.NOTIFICATION_API_SECRET}`,
  },
  body: JSON.stringify({ id: postId, title, excerpt }),
})
```

**ВНИМАНИЕ:** `updatePost()` выполняется на клиенте через Supabase client. Переменные `NOTIFICATION_API_SECRET` и `NEXT_PUBLIC_SITE_URL` на клиенте НЕ доступны (кроме `NEXT_PUBLIC_*`). Поэтому для email при ручной публикации нужен один из двух подходов:

**Вариант A (рекомендуемый):** Создать Route Handler `POST /api/posts/publish` который принимает `postId`, обновляет статус через admin client и вызывает notification endpoint серверно. Клиент вызывает этот route handler вместо прямого Supabase update для сценария `scheduled → published`.

**Вариант B:** Trigger на уровне БД или Edge Function. Избыточно для MVP.

### Кнопка submit — динамический текст

- При `status='published'` (immediate): **«Objavi»** (текущий текст, без изменений)
- При `status='scheduled'`: **«Načrtuj objavo»**
- При edit scheduled поста: **«Shrani spremembe»** (обновить расписание)

### Валидация — кросс-поле через superRefine

```typescript
export const PostFormSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().max(50000).optional(),
  excerpt: z.string().max(500).optional(),
  category: z.string().min(1).max(100),
  is_landing_preview: z.boolean().optional(),
  is_onboarding: z.boolean().optional(),
  status: z.enum(['draft', 'scheduled', 'published']).default('published'),
  scheduled_at: z.string().nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.status === 'scheduled') {
    if (!data.scheduled_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Izberite datum in čas objave',
        path: ['scheduled_at'],
      })
    } else if (new Date(data.scheduled_at) <= new Date()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Izberite čas v prihodnosti',
        path: ['scheduled_at'],
      })
    }
  }
})
```

### snake_case (ОБЯЗАТЕЛЬНО)

Поля из БД используются напрямую: `post.status`, `post.scheduled_at`, `post.published_at`, `post.is_published`. **Не маппить в camelCase.**

### Язык UI — словенский

Весь видимый текст в интерфейсе на **словенском** языке:
- «Objavi zdaj» (Опубликовать сейчас)
- «Načrtuj objavo» (Запланировать)
- «Objava bo objavljena...» (Пост будет опубликован...)
- «Izberite čas v prihodnosti» (Укажите время в будущем)
- «Izberite datum in čas objave» (Укажите дату и время)

### Файлы, которые нужно изменить

| Файл | Изменение |
|------|-----------|
| `src/features/admin/types.ts` | Добавить `status`, `scheduled_at` в PostFormSchema + superRefine |
| `src/features/admin/components/PostForm.tsx` | Добавить scheduling section (toggle + datetime + preview + error) |
| `src/features/admin/api/posts.ts` | Обновить `createPost()` и `updatePost()` для `status`/`scheduled_at` |
| `src/app/api/posts/publish/route.ts` | **Новый** — Route Handler для немедленной публикации scheduled поста с email |
| `tests/unit/features/admin/components/PostForm.test.tsx` | Тесты toggle, datetime, validation |
| `tests/unit/features/admin/api/posts.test.ts` | Тесты createPost/updatePost с scheduled status |
| `tests/unit/app/api/posts/publish/route.test.ts` | **Новый** — тесты publish endpoint |

### Файлы, которые НЕ трогать

- `src/app/api/cron/publish/route.ts` — cron endpoint уже готов (Story 6.2)
- `src/app/api/notifications/new-post/route.ts` — переиспользуется без изменений
- `src/features/feed/` — read-path'ы уже корректно фильтруют по `is_published`
- `supabase/migrations/` — схема БД готова (Story 6.1)
- `src/types/supabase.ts` — типы уже содержат `status`, `scheduled_at`, `published_at`

### Previous Story Intelligence

**Из Story 6.1:**
- `PostForm InitialData` уже типизирован с `status?: 'draft' | 'scheduled' | 'published'` — используй напрямую
- `createPost()` уже пишет `status: 'published'`, `scheduled_at: null` — расширяй, не ломай дефолт
- `updatePost()` снапшотит status-поля для rollback — убедись что новые поля включены
- `published_at` выставляется ПОСЛЕ загрузки медиа (fix из review 6.1) — для scheduled постов НЕ выставлять `published_at`

**Из Story 6.2:**
- Cron endpoint автоматически публикует `scheduled` посты каждые 5 минут
- Условие: `status='scheduled' AND scheduled_at <= now() AND published_at IS NULL`
- Email: вызывает `POST /api/notifications/new-post` per post с `{ id, title, excerpt }`
- **Важно:** при ручной немедленной публикации scheduled поста (AC8) нужно самостоятельно вызвать email, т.к. cron уже не поймает этот пост

**Из Story 4.1:**
- PostForm использует react-hook-form + Zod validation
- Media upload с rollback-механизмом при ошибках
- `createPost()` → INSERT → media upload → UPDATE `published_at` (sequential)
- Curation toggles (`is_landing_preview`, `is_onboarding`) с server-side validation limits

**Из Code Reviews:**
- `timingSafeEqual` для авторизации в Route Handlers
- `response.body?.cancel()` после fetch для возврата соединения в пул
- Guard-проверки env vars перед использованием
- AbortController timeout 10s для fetch к notification endpoint

### Project Structure Notes

- Scheduling section встраивается в существующий `PostForm.tsx` — НЕ создавать отдельный компонент, т.к. это часть формы с общим form state
- Новый Route Handler `src/app/api/posts/publish/route.ts` для ручной публикации — следует паттерну `src/app/api/cron/publish/route.ts`
- Тесты в существующих файлах + новый файл для publish endpoint

### References

- [Source: epics.md#Story-6.3] — полные Acceptance Criteria
- [Source: epics.md#Epic-6-Requirements-Inventory] — FR6.1–FR6.9, UX-DR1–UX-DR9
- [Source: prd-scheduled-publishing.md#User-Journeys] — сценарии использования
- [Source: src/features/admin/components/PostForm.tsx] — существующая форма
- [Source: src/features/admin/api/posts.ts] — API createPost/updatePost
- [Source: src/features/admin/types.ts] — PostFormSchema, PostFormValues
- [Source: src/app/api/cron/publish/route.ts] — паттерн Route Handler + email notification
- [Source: src/app/api/notifications/new-post/route.ts] — email endpoint контракт
- [Source: _bmad-output/stories/6-1-post-status-model-database-schema.md] — schema migration, transitional compatibility
- [Source: _bmad-output/stories/6-2-pg-cron-automatic-publishing-of-scheduled-posts.md] — cron automation, email integration

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
