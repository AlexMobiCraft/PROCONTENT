---
title: 'Поиск: устранение нестабильности и поддержка подстрочного поиска'
type: 'bugfix'
created: '2026-04-08'
status: 'ready'
context:
  - 'src/features/search/components/SearchContainer.tsx'
  - 'src/features/search/api/search.ts'
  - 'src/hooks/useDebounce.ts'
  - 'supabase/migrations/018_add_fts_to_posts.sql'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Поиск по ленте постов нестабилен: результаты «прыгают» при быстром вводе, большие задержки между нажатием клавиши и обновлением результатов, поиск не находит посты по части слова (подстроке).

**Root causes (6 дефектов):**

1. **Race condition** — `AbortController` создаётся в SearchContainer, но `signal` не передаётся в `searchPosts()`. Старые запросы завершаются после новых и перезаписывают актуальные результаты.
2. **Circular dependency** — два `useEffect` создают петлю: `searchParams → setInputValue → debouncedQuery → router.replace → searchParams`. Каждое изменение URL через `router.replace()` вызывает re-render через Suspense boundary.
3. **FTS не ищет подстроки** — PostgreSQL `textSearch` с конфигом `'simple'` ищет только полные токены. Поиск `"vseb"` не найдёт `"vsebina"`. JSDoc в `search.ts` обещает fallback на `.ilike()`, но он не реализован.
4. **Flash при коротком запросе** — при снижении длины запроса ниже `MIN_QUERY_LENGTH=3` результаты мгновенно сбрасываются (`setResults([])` без debounce), создавая визуальный рывок.
5. **Фильтр по legacy-колонке** — `search.ts:27` использует `.eq('is_published', true)` вместо каноничного `status = 'published'` (введён в Epic 6).
6. **Нет кэширования** — каждый запрос идёт в БД; повторный ввод прежнего запроса вызывает новый network round-trip.

**Approach:** Починить race condition и circular dependency (критичные), заменить FTS на pg_trgm для подстрочного поиска, устранить мелкие дефекты.

## Boundaries & Constraints

**Always:**
- Использовать существующий Supabase client из `@/lib/supabase/client`
- Сохранять URL-синхронизацию `?q=` (shareable links), но однонаправленную: input → URL (без обратного чтения)
- Сохранять `MIN_QUERY_LENGTH = 3`
- UI-текст остаётся на словенском языке

**Ask First:**
- Если потребуется RPC-функция для поиска — уточнить имя и сигнатуру
- Если `pg_trgm` не доступен в Supabase-плане — обсудить альтернативу (ILIKE + application-level fallback)

**Never:**
- Не добавлять сторонние библиотеки поиска (Algolia, Meilisearch и т.д.)
- Не трогать логику ленты (`FeedContainer`, `useFeedStore`) — только модуль `search/`
- Не менять PostCard и отображение результатов — только поиск и фильтрацию
- Не убирать GIN-индекс на `fts` — он может использоваться elsewhere

## Defect Details & Fix Strategy

### D1 — Race condition (Критично)

**Файлы:** `SearchContainer.tsx:167-190`, `search.ts:17-35`

**Проблема:** `AbortController` создаётся и.abort() вызывается при cleanup, но `searchPosts()` не принимает `signal` — Supabase-запрос летит в сеть без возможности отмены. Старые ответы перезаписывают новые.

**Fix:**
- Добавить параметр `signal?: AbortSignal` в `searchPosts()`
- Передать `signal` в Supabase через `.abortSignal(signal)` (поддерживается `@supabase/supabase-js` v2+)
- В `SearchContainer` передавать `controller.signal` при вызове

### D2 — Circular dependency URL ↔ state (Критично)

**Файлы:** `SearchContainer.tsx:146-155`

**Проблема:** Два эффекта:
1. `searchParams` → `setInputValue()` (строка 148)
2. `debouncedQuery` → `router.replace()` → URL → `searchParams` (строки 152-155)

`router.replace()` вызывает обновление Suspense boundary → re-render → эффект #1 срабатывает → `setInputValue()` → potential re-render.

**Fix:**
- Убрать эффект #1 (чтение из `searchParams` в `inputValue`)
- Начальное значение `inputValue` брать только из `initialQuery` prop (уже передаётся из RSC page)
- Оставить однонаправленную синхронизацию: input → debouncedQuery → URL
- Для кнопки «Назад» в браузере: использовать `popstate` listener или `next/navigation` `beforePopState` — не `useSearchParams` эффект

### D3 — FTS не ищет подстроки (Критично)

**Файлы:** `search.ts:28`, миграция `018_add_fts_to_posts.sql`

**Проблема:** `textSearch('fts', query, { type: 'websearch', config: 'simple' })` ищет только полные слова. Конфиг `simple` не даёт stemming для словенского. Комментарий в коде обещает `.ilike()` fallback — не реализован.

**Fix — двухуровневый подход:**

**Миграция:** Создать новую миграцию `039_search_pg_trgm.sql`:
```sql
-- Включаем расширение pg_trgm для подстрочного поиска
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Триграмм-индексы на title и excerpt (основные видимые поля)
CREATE INDEX IF NOT EXISTS idx_posts_title_trgm
  ON public.posts USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_posts_excerpt_trgm
  ON public.posts USING GIN (excerpt gin_trgm_ops);
```

**API:** Заменить `textSearch` на комбинацию:
- Primary: `.or('title.ilike.%query%,excerpt.ilike.%query%')` — подстрочный поиск по title и excerpt (покрытие GIN pg_trgm)
- Secondary: `.textSearch('fts', query, { type: 'websearch', config: 'simple' })` — полнотекстовый по content
- Объединить через RPC `search_posts(p_query text)` с `UNION` или через два параллельных запроса
- Если RPC не подходит — использовать `or()` фильтр Supabase для ILIKE + FTS в одном запросе

**Приоритет видимости:** title > excerpt > content. Результаты сортируются: совпадение в title → выше.

### D4 — Flash при коротком запросе (Minor)

**Файлы:** `SearchContainer.tsx:159-164`

**Проблема:** При длине `debouncedQuery` < 3 — мгновенный `setResults([])`. Если до этого были результаты — визуальный «всплеск» пустого состояния.

**Fix:**
- Добавить `prevQueryRef` (useRef) для отслеживания предыдущего валидного запроса
- При падении ниже MIN_QUERY_LENGTH — не сбрасывать результаты сразу, а показать hint + оставить старые результаты visible
- Сбрасывать результаты только при полном очищении input (пробел/empty)

### D5 — Legacy фильтр is_published (Medium)

**Файлы:** `search.ts:27`

**Проблема:** `.eq('is_published', true)` — legacy поле. Каноничный фильтр после Epic 6: `status = 'published'`.

**Fix:**
- Заменить на `.eq('status', 'published')`
- Проверить, что RLS-политики и индексы покрывают `status` (должны — индекс `idx_posts_cursor` уже есть с `WHERE is_published = true`, но стоит обновить)

### D6 — Нет кэширования (Low)

**Файлы:** `SearchContainer.tsx` или новый хук

**Проблема:** Каждый ввод после debounce → новый запрос в БД. При возврате к прежнему запросу — повторный round-trip.

**Fix:**
- Добавить `useRef<Map<string, Post[]>>` кэш в SearchContainer
- Перед запросом проверять кэш: если есть — сразу setResults, skip network
- Размер кэша: ограничить 20 записями (LRU или просто Map с delete oldest)
- Кэш инвалидируется при unmount компонента

## Code Map

| Файл | Изменение |
|------|-----------|
| `supabase/migrations/039_search_pg_trgm.sql` | **Новый** — pg_trgm + триграмм-индексы |
| `src/features/search/api/search.ts` | Рефактор: signal param, ILIKE + FTS, фильтр status |
| `src/features/search/components/SearchContainer.tsx` | Рефактор: убрать circular dep, кэш, flash fix |
| `tests/unit/features/search/api/search.test.ts` | Обновить тесты под новый API |
| `tests/unit/features/search/components/SearchContainer.test.tsx` | Обновить тесты под новые эффекты |

## Tasks & Acceptance

### Фаза 1 — Критические (D1 + D2 + D3)

**Execution:**

- [ ] `supabase/migrations/039_search_pg_trgm.sql` — Создать миграцию: `CREATE EXTENSION pg_trgm`, GIN-индексы на `title` и `excerpt` через `gin_trgm_ops`
- [ ] `src/features/search/api/search.ts` — Рефактор: добавить `signal?: AbortSignal`, заменить `.textSearch` на гибридный поиск (ILIKE по title/excerpt + FTS по content через `.or()` или RPC), фильтр `.eq('status', 'published')`
- [ ] `SearchContainer.tsx` — Передать `controller.signal` в `searchPosts(debouncedQuery, controller.signal)`
- [ ] `SearchContainer.tsx` — Убрать эффект синхронизации `searchParams → setInputValue` (строки 146-149), оставить только `initialQuery` для первого рендера
- [ ] `tests/unit/features/search/api/search.test.ts` — Обновить тесты: verify signal передаётся, verify ILIKE + FTS запрос, verify фильтр по `status`

**Acceptance Criteria:**

- [ ] **Given** пользователь быстро вводит «vsebina» (7 символов), **when** каждый символ триггерит search, **then** только последний запрос выполняется — предыдущие отменены через AbortSignal
- [ ] **Given** запрос «vseb», **when** в БД есть пост с title «Vsebina za vas», **then** пост находится (подстрочный поиск работает)
- [ ] **Given** запрос «vsebina za vas», **when** слова разделены пробелом, **then** FTS находит пост по content (полнотекстовый поиск сохранён)
- [ ] **Given** ввод текста, **when** URL обновляется через router.replace, **then** компонент не перерендеривается повторно (нет circular dependency)
- [ ] **Given** пост со `status='scheduled'`, **when** выполняется поиск, **then** пост НЕ появляется в результатах

### Фаза 2 — Средние (D4 + D5)

**Execution:**

- [ ] `SearchContainer.tsx` — При падении query < 3: оставить старые результаты видимыми, показать hint; сбросить только при полном очищении
- [ ] Проверить/обновить индекс `idx_posts_cursor` для `status = 'published'` (если нужен)

**Acceptance Criteria:**

- [ ] **Given** результаты для «vsebina» на экране, **when** пользователь стирает до «vs» (< 3), **then** результаты остаются видимыми + hint «Vpišite vsaj 3 znake»
- [ ] **Given** пользователь полностью очистил input, **when** query = '', **then** результаты сброшены, показано стартовое empty state

### Фаза 3 — Полировка (D6)

**Execution:**

- [ ] `SearchContainer.tsx` — Добавить in-memory кэш `Map<string, Post[]>` (макс. 20 записей), проверять кэш перед network-запросом

**Acceptance Criteria:**

- [ ] **Given** пользователь искал «vsebina» → получил результаты, **when** стирает до «vse» и снова вводит «vsebina», **then** результаты отображаются мгновенно (из кэша, без network-запроса)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output | Error Handling |
|----------|--------------|-----------------|----------------|
| Подстрочный поиск | query = «vseb» | Посты с «Vsebina» в title/excerpt найдены | — |
| Быстрый ввод | 5 символов за 1 сек | Только 1 запрос (последний), остальные отменены | — |
| Пустой запрос | query = «» | Стартовый empty state, результатов нет | — |
| Короткий запрос (были результаты) | query = «vs» (< 3), до этого «vse» | Старые результаты видимы + hint | — |
| Спецсимволы | query = «test%_like» | ILIKE экранирует `%` и `_`, поиск корректен | Не должно crash'ить |
| Кирилица | query = «кон» (3 символа) | Поиск работает, MIN_QUERY_LENGTH = 3 ок | — |
| Ошибка сети | Supabase возвращает error | Toast «Iskanje ni uspelo. Poskusite znova.» | — |
| Нет результатов | query = «xyz123» | «Ni zadetkov» empty state | — |
| URL shareable | `/search?q=vsebina` | Страница открывается с результатами для «vsebina» | initialQuery из RSC |

</frozen-after-approval>

## Spec Change Log

## Design Notes

**Почему pg_trgm, а не чистый ILIKE:** ILIKE `%query%` не использует индексы (sequential scan). pg_trgm с GIN-индексом `gin_trgm_ops` поддерживает index-backed ILIKE — запросы остаются быстрыми при росте числа постов. Расширение `pg_trgm` доступно во всех планах Supabase по умолчанию.

**Почему не убираем FTS полностью:** FTS по `content` (длинный текст) остаётся полезным для поиска по полным словам. Триграммный поиск по content создал бы огромный индекс. Комбинация: trgm для title/excerpt (короткие поля) + FTS для content (длинное поле).

**Почему убираем searchParams → setInputValue эффект:** В Next.js App Router `useSearchParams()` оборачивает ближайший Suspense boundary. `router.replace()` триггерит обновление этого boundary, что вызывает cascade re-render'ов. Однонаправленная синхронизация (input → URL) устраняет проблему, при этом начальное значение корректно приходит через `initialQuery` prop из RSC `page.tsx`.

## Verification

**Commands:**
- `npm run typecheck` — expected: exit 0
- `npm run lint` — expected: exit 0
- `npm run test` — expected: все search-тесты проходят

**Manual checks:**
- Ввести «vseb» — должны найтись посты с «Vsebina» в заголовке
- Быстро набрать 7-8 символов — результаты не должны «прыгать»
- Стереть до 2 символов — старые результаты должны оставаться на экране
- Полностью очистить input — должно показаться стартовое empty state
- Скопировать URL `/search?q=vsebina` в новую вкладку — результаты должны загрузиться
