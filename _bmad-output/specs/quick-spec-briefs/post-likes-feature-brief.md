# Brief: Функция лайков с персистентностью (post_likes)

**Дата:** 2026-03-21
**Контекст:** Story 2.2 Iteration 18 — технический долг, выявленный в code review

---

## Текущее состояние (что уже сделано)

### `PostCardData` (`src/components/feed/PostCard.tsx`)
```ts
isLiked?: boolean  // добавлено в Iteration 18 — готово принять серверное значение
```

### Формула `likeCount` без двойного подсчёта (Iteration 18):
```ts
const likeCount = post.likes - (post.isLiked ? 1 : 0) + (liked ? 1 : 0)
```

### `onLikeToggle` проп в `PostCard`:
```ts
onLikeToggle?: (postId: string, liked: boolean) => void
```
Вызывается при клике, но **`FeedContainer` его не передаёт** — API-вызова нет. Лайки работают только визуально.

---

## Что отсутствует в БД

**Текущая схема `posts`:** только `likes_count INTEGER NOT NULL DEFAULT 0` — счётчик без связи с пользователем. Нет таблицы `post_likes`, нет поля `is_liked`.

**Последняя миграция:** `013_add_non_negative_count_checks.sql` → следующая будет `014_`.

**Паттерн RLS в проекте:** только пользователи со `subscription_status IN ('active', 'trialing')` могут читать посты (миграция 008).

---

## Что нужно построить

### 1. БД — таблица `post_likes`
```sql
CREATE TABLE public.post_likes (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX idx_post_likes_post_user ON public.post_likes(post_id, user_id);
```
- UNIQUE ключ `(post_id, user_id)` предотвращает дублирование
- RLS: вставлять/удалять только свои записи; читать — только подписчики
- Триггер для атомарного инкремента/декремента `posts.likes_count`

### 2. API — эндпоинт лайка
**Вариант A (REST):** `POST /api/posts/[id]/like` и `DELETE /api/posts/[id]/like`
**Вариант B (RPC):** `supabase.rpc('toggle_like', { p_post_id })` — один вызов

Возвращает: `{ likes_count: number, is_liked: boolean }`

### 3. Запрос ленты — добавить `is_liked`
В `fetchPosts` и `fetchInitialPostsServer` добавить подзапрос:
```sql
EXISTS (
  SELECT 1 FROM post_likes
  WHERE post_id = posts.id AND user_id = auth.uid()
) AS is_liked
```

### 4. TypeScript типы
- `src/types/supabase.ts` — добавить таблицу `post_likes`
- `src/features/feed/types.ts` — `PostRow` получает `is_liked: boolean`
- `src/features/feed/types.ts` — `dbPostToCardData` прокидывает `isLiked: post.is_liked ?? false`

### 5. `FeedContainer` — интеграция
```ts
async function handleLikeToggle(postId: string, liked: boolean) {
  // 1. Оптимистичное обновление store
  const previousPosts = getState().posts
  updatePostLikesOptimistically(postId, liked)

  try {
    // 2. API вызов
    const { likes_count } = await toggleLike(postId, liked)
    // 3. Синхронизация с сервером
    syncPostLikesCount(postId, likes_count)
  } catch {
    // 4. Откат при ошибке
    setPosts(previousPosts)
  }
}
```
Передать `onLikeToggle={handleLikeToggle}` в `<PostCard>`.

---

## Файлы, затрагиваемые изменениями

| Файл | Операция |
|---|---|
| `supabase/migrations/014_create_post_likes.sql` | new |
| `src/types/supabase.ts` | modify — добавить `post_likes` |
| `src/features/feed/types.ts` | modify — `PostRow.is_liked`, `dbPostToCardData` |
| `src/features/feed/api/posts.ts` | modify — добавить `is_liked` в SELECT |
| `src/features/feed/api/serverPosts.ts` | modify — добавить `is_liked` в SELECT |
| `src/features/feed/components/FeedContainer.tsx` | modify — `handleLikeToggle`, оптимистичное обновление |
| `src/app/api/posts/[id]/like/route.ts` | new (если REST) |
| `tests/unit/features/feed/components/FeedContainer.test.tsx` | modify |
| `tests/unit/components/feed/PostCard.test.tsx` | modify (проверить `isLiked`) |

---

## Технические ограничения и решения

| Вопрос | Решение |
|---|---|
| Атомарность `likes_count` | Триггер на `INSERT/DELETE` в `post_likes` (надёжнее RPC) |
| Race condition двойного лайка | UNIQUE `(post_id, user_id)` + `INSERT ... ON CONFLICT DO NOTHING` |
| Производительность запроса ленты | Индекс `idx_post_likes_post_user(post_id, user_id)` |
| Аноним / незалогин | `auth.uid() IS NULL` → `is_liked = false` (NULL-safe EXISTS) |
| Откат оптимистичного обновления | `previousPosts` snapshot перед мутацией, `setPosts(previousPosts)` в catch |
| Нет негативного `likes_count` | CHECK constraint уже есть (мигр. 013); триггер не декрементирует ниже 0 |
