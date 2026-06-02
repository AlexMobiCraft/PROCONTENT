---
title: 'Восстановление позиции скролла при возврате из поста в категориях'
type: 'bugfix'
created: '2026-06-02'
status: 'done'
context: []
baseline_commit: '8a0cf59749bbc148fc154761f15e47e7ebbdd14f'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** При выбранной категории (`activeCategory !== 'all'`) возврат из открытого поста по кнопке «Nazaj» прокручивает ленту в самое начало вместо позиции, где был открыт пост. На главной (категория «VSE»/`all`) восстановление работает корректно.

**Approach:** Причина — category-эффект `FeedContainer` на первом маунте для не-`all` категорий безусловно сбрасывает кэш постов (`setPosts([], null, true)`) и перезагружает ленту, из-за чего контент схлопывается и `window.scrollTo(savedY)` в `FeedPageClient` отрабатывает по пустому списку. Нужно при возврате из поста (признак — наличие `sessionStorage['feed:scrollY']` и непустой store) сохранять кэшированные посты вместо сброса — ровно так, как это уже делает ветка `all`.

## Boundaries & Constraints

**Always:** Сохранять текущую логику для трёх остальных сценариев первого маунта: (1) реальная смена категории кликом по табу — сброс+перезагрузка; (2) не-`all` категория без сигнала восстановления скролла — сброс+перезагрузка; (3) `all` — без сброса. Признак возврата из поста: `sessionStorage.getItem('feed:scrollY') !== null` И store содержит посты. Использовать `snake_case` для полей БД.

**Ask First:** Изменение контракта/ключа `feed:scrollY` или места его установки/очистки (PostCard / FeedPageClient).

**Never:** Не трогать infinite-scroll observer, stall-детекцию, пагинацию и like-логику. Не добавлять persist в Zustand. Не вводить новые роуты категорий. Не менять поведение главной (`all`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Возврат из поста в категории | `activeCategory='reels'`, store с постами, `feed:scrollY` установлен | Посты сохраняются, `fetchPosts` НЕ вызывается, скролл восстанавливается | N/A |
| Возврат из поста на главной | `activeCategory='all'`, store с постами, `feed:scrollY` установлен | Без изменений: посты сохраняются, скролл восстанавливается | N/A |
| Клик по табу категории | переход `all → reels` (не первый маунт) | Сброс store + перезагрузка под новую категорию | N/A |
| Первый маунт категории без возврата | `activeCategory='reels'`, нет `feed:scrollY` | Сброс store + перезагрузка (поведение без изменений) | N/A |

</frozen-after-approval>

## Code Map

- `src/features/feed/components/FeedContainer.tsx` -- category-эффект (строки ~181-224); ветка не-`all` первого маунта (~204-206) безусловно сбрасывает store — место правки
- `src/features/feed/components/FeedPageClient.tsx` -- восстановление скролла по `feed:scrollY` в useEffect (mount) — контекст, не меняется
- `src/components/feed/PostCard.tsx` -- `saveScrollY()` пишет `feed:scrollY` перед `router.push` — контекст, не меняется
- `tests/unit/features/feed/components/FeedContainer.test.tsx` -- набор тестов первого маунта/категорий — добавить кейс

## Tasks & Acceptance

**Execution:**
- [x] `src/features/feed/components/FeedContainer.tsx` -- В ветке `isFirstMount && activeCategory !== 'all'` добавить условие: если `sessionStorage.getItem('feed:scrollY') !== null` и `useFeedStore.getState().posts.length > 0`, НЕ вызывать `setPosts([], null, true)` и `loadInitial()` — сохранить кэш для восстановления скролла. Иначе — прежнее поведение (сброс + загрузка). SSR-safe guard на `typeof window`.
- [x] `tests/unit/features/feed/components/FeedContainer.test.tsx` -- Тест: не-`all` категория + store с постами + `feed:scrollY` установлен → `fetchPosts` не вызван, посты в DOM. Очистка `sessionStorage` в afterEach.

**Acceptance Criteria:**
- Given выбрана категория и пользователь открыл пост, when он нажимает «Nazaj», then лента возвращается к позиции открытого поста, а не в начало.
- Given пользователь на главной («VSE»), when возврат из поста, then поведение восстановления скролла не изменилось.
- Given пользователь кликает по табу категории, when лента перезагружается, then показываются посты только новой категории (регресс не допущен).

## Design Notes

Правка точечная — мирроринг существующей `all`-ветки (FeedContainer.tsx:207-212) и эффекта гидрации (122-138), которые уже сохраняют store при `feed:scrollY`. Эскиз:

```ts
if (activeCategory !== 'all') {
  const isRestoringScroll =
    typeof window !== 'undefined' &&
    sessionStorage.getItem('feed:scrollY') !== null
  const storeHasPosts = useFeedStore.getState().posts.length > 0
  if (isRestoringScroll && storeHasPosts) {
    // возврат из поста — сохраняем кэш, FeedPageClient восстановит скролл
  } else {
    useFeedStore.getState().setPosts([], null, true)
    void loadInitial()
  }
}
```

`feed:scrollY` очищается в `FeedPageClient` после восстановления — повторных «ложных» сохранений не будет.

## Verification

**Commands:**
- `npm run test -- FeedContainer` -- expected: все тесты зелёные, включая новый кейс
- `npm run typecheck` -- expected: без ошибок
- `npm run lint` -- expected: без ошибок

**Manual checks:**
- Выбрать категорию (не «VSE») → проскроллить вниз → открыть пост → «Nazaj» → лента на той же позиции/посте.
- Повторить на «VSE» → поведение прежнее.

## Suggested Review Order

**Логика восстановления скролла**

- Точка входа: guard первого маунта для не-`all` категорий — сохраняет кэш при возврате из поста.
  [`FeedContainer.tsx:210`](../../src/features/feed/components/FeedContainer.tsx#L210)

- Вычисление признака возврата (`feed:scrollY` + непустой store) и флага перезагрузки.
  [`FeedContainer.tsx:211`](../../src/features/feed/components/FeedContainer.tsx#L211)

**Тесты**

- Happy-path: возврат в категории сохраняет кэш, `fetchPosts` не вызван.
  [`FeedContainer.test.tsx:276`](../../tests/unit/features/feed/components/FeedContainer.test.tsx#L276)

- Негативный кейс: `feed:scrollY` есть, но store пуст → обычная перезагрузка категории.
  [`FeedContainer.test.tsx:293`](../../tests/unit/features/feed/components/FeedContainer.test.tsx#L293)

- Очистка sessionStorage между тестами.
  [`FeedContainer.test.tsx:115`](../../tests/unit/features/feed/components/FeedContainer.test.tsx#L115)
