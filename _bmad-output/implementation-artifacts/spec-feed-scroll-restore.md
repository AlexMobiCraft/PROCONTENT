---
title: 'Feed Scroll Restore'
type: 'feature'
created: '2026-04-06'
status: 'done'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** При возврате из детальной страницы поста лента прокручивается в начало — пользователь теряет место и вынужден скроллить заново.

**Approach:** Перед переходом на страницу поста сохранять `scrollY` в `sessionStorage`; при монтировании страницы ленты (если пришли с поста) восстанавливать позицию.

## Boundaries & Constraints

**Always:**
- Хранить позицию только в `sessionStorage` (не `localStorage`) — данные сессионные
- Восстанавливать скролл только если пользователь вернулся из поста ленты (`from=feed` в searchParams) — не при прямом заходе
- Посты должны быть уже в DOM к моменту восстановления (store персистируется через навигацию Next.js, `initialData` не перезаписывает, если посты есть)

**Ask First:**
- Если Next.js Router Cache вызовет повторный рендер с пустым store — нужно решить: ждать гидрации или использовать другой подход

**Never:**
- Не трогать логику пагинации и infinite scroll
- Не добавлять виртуализацию
- Не использовать `useLayoutEffect` — только `useEffect` + `requestAnimationFrame`

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Возврат с поста | Пользователь открыл пост, нажал "назад" | Лента восстанавливает позицию скролла | sessionStorage пустой → scrollY=0 (без эффекта) |
| Прямой заход на ленту | Нет `from=feed` в URL | Скролл не восстанавливается, лента с начала | — |
| Смена категории → возврат | Другая категория, другие посты | Скролл не восстанавливается (посты другие) | Нет ключа — scrollY=0 |
| Несколько вкладок | Разные позиции в разных вкладках | sessionStorage изолирован по вкладкам — ок | — |

</frozen-after-approval>

## Code Map

- `src/components/feed/PostCard.tsx` — клик по карточке → `router.push`, здесь сохранять `window.scrollY`
- `src/features/feed/components/FeedPageClient.tsx` — точка входа страницы ленты, здесь восстанавливать скролл
- `src/features/feed/components/FeedContainer.tsx` — рендеринг списка постов, infinite scroll (не трогать)
- `src/app/(app)/feed/page.tsx` — RSC, передаёт `searchParams` в FeedPageClient

## Tasks & Acceptance

**Execution:**
- [ ] `src/components/feed/PostCard.tsx` -- в `handleCardClick` перед `router.push()` сохранить `sessionStorage.setItem('feed:scrollY', String(window.scrollY))` -- фиксируем позицию до ухода со страницы
- [ ] `src/features/feed/components/FeedPageClient.tsx` -- в `useEffect` при монтировании: если `searchParams.from === 'feed'` и есть ключ `feed:scrollY` в sessionStorage — вызвать `requestAnimationFrame(() => window.scrollTo(0, savedY))` и удалить ключ -- восстанавливаем позицию после гидрации DOM

## Spec Change Log

## Design Notes

`requestAnimationFrame` нужен чтобы браузер успел отрисовать посты из store до вызова `scrollTo`. Store персистируется через Next.js Router Cache — посты уже в памяти, DOM появляется синхронно при монтировании.

Ключ `feed:scrollY` удаляется после прочтения — чтобы прямой заход на ленту не восстанавливал старую позицию.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0
- `npm run lint` -- expected: exit 0

**Manual checks:**
- Проскроллить ленту вниз → открыть пост → нажать "назад" → лента должна открыться на том же месте
- Зайти на ленту напрямую → скролл с начала (не восстанавливается)
- Открыть пост → обновить страницу ленты → скролл с начала
