---
title: 'Search Fixes — 6 дефектов системы поиска'
type: 'bugfix'
created: '2026-04-08'
status: 'ready-for-dev'
context:
  - '_bmad-output/stories/2-7-search-across-the-entire-knowledge-base.md'
  - '_bmad-output/stories/6-1-post-status-model-database-schema.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** После завершения Epic 6 (Scheduled Publishing) в системе поиска обнаружено 6 дефектов:

1. Scheduled посты невидимы после cron-публикации (критично — затрагивает ленту и поиск)
2. AbortController не подключён к Supabase-запросу → race condition при быстром вводе
3. FTS не ищет по подстрокам — "vseb" не найдёт "vsebina"
4. Нет fallback при невалидном tsquery — поиск падает с ошибкой
5. Circular URL sync → лишние re-renders каждые 400ms
6. Нет кэша результатов → повторные запросы при возврате к прежнему запросу

**Approach:**
- Баг 1 исправляем в cron handler — минимальный риск, не затрагивает RLS и другие запросы
- Баг 2 исправляем передачей signal в searchPosts
- Баги 3+4 исправляем комбинированным запросом FTS + ILIKE-fallback в search.ts (без новых миграций)
- Баг 5 исправляем через `useRef`-флаг для различения пользовательского ввода от URL-изменений
- Баг 6 исправляем через in-memory `Map` кэш в SearchContainer

## Boundaries & Constraints

**Always:**
- `is_published` сохраняем как legacy-синхронизацию: при публикации через cron обновлять оба поля
- ILIKE-запросы применять только к полям `title` и `excerpt` (не `content` — потенциально большой)
- Кэш хранить только в runtime (`useRef`) — не в sessionStorage и не в Zustand
- Debounce 400ms сохранить

**Ask First:**
- Если pg_trgm нужен как полноценное решение взамен ILIKE — требует отдельной миграции и обсуждения

**Never:**
- Не переключать fetchPosts/RLS-политики с `is_published` на `status` — это отдельный рефакторинг
- Не увеличивать кэш до localStorage или cross-session хранилища
- Не убирать MIN_QUERY_LENGTH = 3

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output | Error Handling |
|----------|--------------|-----------------|----------------|
| Scheduled пост опубликован cron | `status='scheduled'`, `scheduled_at <= now()` | Пост появляется в ленте и поиске | cron возвращает 500 → пост остаётся scheduled |
| Быстрый ввод "v", "vs", "vseb" | 3 символа+ | Только один запрос летит, старые отменяются | AbortError игнорируется |
| Поиск по части слова "vseb" | FTS не находит | ILIKE находит "vsebina", "vsebnost" | Оба запроса объединены через OR |
| Невалидный tsquery `(abc` | textSearch кидает ошибку | Fallback на чистый ILIKE | Если оба упали — показать "Iskanje ni uspelo" |
| Пользователь ввёл "abc" → "abcd" → стёр "d" | возврат к "abc" | Результаты из кэша без нового запроса | Кэш пустой → обычный запрос |
| URL ?q=vsebina при заходе | initialQuery="vsebina" | Поиск выполняется сразу, URL не сбрасывается | — |
| Навигация "Назад/Вперёд" | searchParams меняется от браузера | inputValue обновляется из URL | Не вызывает лишний поиск |

</frozen-after-approval>

## Code Map

- `src/app/api/cron/publish/route.ts:62` — UPDATE scheduled→published, здесь добавить `is_published: true`
- `src/features/search/api/search.ts` — функция searchPosts: добавить signal + комбинированный запрос FTS|ILIKE
- `src/features/search/components/SearchContainer.tsx` — передать signal, добавить кэш, исправить circular sync

## Tasks & Acceptance

### Задача 1 — Баг #5: синхронизировать `is_published` при cron-публикации

- [ ] `src/app/api/cron/publish/route.ts:62` — добавить `is_published: true` в объект `.update({...})`:
  ```typescript
  .update({ status: 'published', published_at: now, is_published: true })
  ```
- [ ] Убедиться, что typecheck проходит (`status` и `is_published` оба есть в типах Database)

**AC:** Scheduled пост с `status='scheduled'` после запуска cron handler имеет `status='published'` И `is_published=true`.

---

### Задача 2 — Баг #2: передать AbortSignal в searchPosts

- [ ] `src/features/search/api/search.ts` — изменить сигнатуру функции, добавить `signal` к Supabase-запросу:
  ```typescript
  export async function searchPosts(
    query: string,
    options?: { signal?: AbortSignal }
  ): Promise<Post[]>
  ```
  В теле: перед `.limit()` добавить:
  ```typescript
  if (options?.signal) {
    query = query.abortSignal(options.signal)
  }
  ```
- [ ] `src/features/search/components/SearchContainer.tsx:172` — передать signal:
  ```typescript
  searchPosts(debouncedQuery, { signal: controller.signal })
  ```

**AC:** При вводе "v" → "vs" → "vseb" в Network devtools виден только один активный запрос; предыдущие отменяются (статус `canceled`).

---

### Задача 3 — Баги #1 + #4: комбинированный поиск FTS + ILIKE + fallback

- [ ] `src/features/search/api/search.ts` — заменить `.textSearch(...)` на комбинированную функцию:

  ```typescript
  // Попытка 1: FTS (быстро, по полным словам) + ILIKE (по подстрокам в title/excerpt)
  async function runSearch(
    supabase: ReturnType<typeof createClient>,
    query: string,
    signal?: AbortSignal
  ) {
    const selectClause =
      '*, profiles!author_id(display_name, avatar_url), ' +
      'post_media(id, media_type, url, thumbnail_url, order_index, is_cover), ' +
      'is_liked:posts_is_liked'

    const ilikePattern = `%${query.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`

    let q = supabase
      .from('posts')
      .select(selectClause)
      .eq('is_published', true)
      .or(
        `fts.wfts(simple).${query},title.ilike.${ilikePattern},excerpt.ilike.${ilikePattern}`
      )
      .order('created_at', { ascending: false })
      .limit(50)

    if (signal) q = q.abortSignal(signal)

    const { data, error } = await q

    if (error) throw error
    return data
  }
  ```

  > **Примечание для реализации:** Supabase `.or()` с `.wfts()` может не поддерживаться напрямую — в этом случае реализовать через два параллельных запроса с последующим мержем (дедупликация по `id`):
  > 1. FTS-запрос через `.textSearch('fts', query, { type: 'websearch', config: 'simple' })`
  > 2. ILIKE-запрос через `.ilike('title', ilikePattern).or('excerpt.ilike.' + ilikePattern)`
  > 3. Смержить: FTS-результаты первыми, затем ILIKE-уникальные (не попавшие в FTS)

- [ ] При ошибке FTS — не пробрасывать, а пробовать чистый ILIKE:
  ```typescript
  try {
    return await ftsQuery(...)
  } catch {
    return await ilikeQuery(...)  // fallback
  }
  ```

- [ ] Экранировать спецсимволы `%` и `_` в query перед ILIKE во избежание SQL-инъекций через паттерн

**AC:**
- Поиск "vseb" находит посты со словами "vsebina", "vsebnost"
- Поиск "obja" находит посты со словом "objava", "objave"
- При FTS-ошибке (невалидный символ в query) поиск не падает, показывает ILIKE-результаты

---

### Задача 4 — Баг #5: устранить circular URL sync

- [ ] `src/features/search/components/SearchContainer.tsx` — добавить `isUserInput` ref и изменить логику двух useEffect:

  ```typescript
  const isUserInputRef = useRef(false)

  // Пользовательский ввод — помечаем флагом
  function handleInputChange(v: string) {
    isUserInputRef.current = true
    setInputValue(v)
  }
  // Передать handleInputChange в <SearchInput onChange={handleInputChange} />

  // Синхронизация URL → state (только при навигации Назад/Вперёд, не при пользовательском вводе)
  useEffect(() => {
    if (isUserInputRef.current) {
      isUserInputRef.current = false
      return
    }
    setInputValue(searchParams.get('q') ?? '')
  }, [searchParams])
  ```

**AC:** В React DevTools профайлере при вводе одного символа компонент перерисовывается не более 2 раз (inputValue + debouncedQuery); `router.replace` вызывается только один раз за debounce-период.

---

### Задача 5 — Баг #6: кэш результатов in-memory

- [ ] `src/features/search/components/SearchContainer.tsx` — добавить `resultsCache` ref перед основным useEffect поиска:

  ```typescript
  const resultsCache = useRef<Map<string, Post[]>>(new Map())
  ```

- [ ] В useEffect поиска — перед вызовом `searchPosts` проверить кэш, после успешного ответа — сохранить:

  ```typescript
  const cached = resultsCache.current.get(debouncedQuery)
  if (cached) {
    setResults(cached)
    setIsLoading(false)
    return
  }

  // ... вызов searchPosts ...

  .then((posts) => {
    if (controller.signal.aborted) return
    resultsCache.current.set(debouncedQuery, posts)
    setResults(posts)
  })
  ```

- [ ] Ограничить размер кэша: если `resultsCache.current.size > 20` — удалить первую запись (FIFO)

**AC:** Набрать "vsebina" → стереть до "vseb" → набрать "vsebina" снова → в Network devtools второй запрос не летит, результаты появляются мгновенно.

## Spec Change Log

- 2026-04-08: Создана спека по результатам аудита двух разработчиков

## Design Notes

**Почему не переключаем на `status='published'` в fetchPosts и RLS?**
Это потребует переписать 6+ миграций и все RLS-политики. Риск высокий, scope большой. Фикс в cron handler — минимальное изменение с максимальным эффектом: оба поля будут синхронизированы.

**Почему ILIKE, а не pg_trgm?**
pg_trgm требует новой миграции (`CREATE EXTENSION pg_trgm` + GIN-индексы). При текущем объёме контента ILIKE на `title` и `excerpt` работает достаточно быстро. pg_trgm — следующий шаг при росте базы (>10k постов).

**Почему `useRef` для флага, а не сравнение значений в useEffect?**
Сравнение `inputValue === searchParams.get('q')` тоже работает, но при быстром вводе возможны edge cases когда значения временно совпадают. `useRef` — явный флаг намерения.

**Порядок выполнения задач:**
Задачи независимы, но рекомендуется порядок: 1 → 2 → 3 → 4 → 5.
Задача 1 критична и занимает 5 минут — начинать с неё.

## Verification

**Commands:**
- `npm run typecheck` — expected: exit 0
- `npm run lint` — expected: exit 0
- `npm run test` — expected: все тесты зелёные

**Manual checks:**
- [ ] Создать scheduled пост → дождаться cron → пост виден в ленте и поиске
- [ ] Открыть поиск → быстро набрать 5+ символов → в Network только 1 запрос активен
- [ ] Поиск "vseb" → должны появиться посты с "vsebina"
- [ ] Поиск "obja" → должны появиться посты с "objava"
- [ ] Набрать "vsebina" → стереть до "vseb" → набрать "vsebina" — второй раз без сетевого запроса
- [ ] Открыть поиск → `?q=vsebina` в URL → результаты загружаются → нажать Назад → inputValue сбрасывается
