---
title: 'Кнопка отправки комментария скрыта за мобильным меню'
type: 'bugfix'
created: '2026-06-14'
status: 'done'
route: 'one-shot'
---

# Кнопка отправки комментария скрыта за мобильным меню

## Intent

**Problem:** На странице поста в мобильной версии форма комментария находится в самом низу `<article>`, у которого нет нижнего отступа под фиксированную панель `MobileNav` (`fixed bottom-0`, `min-h-[60px]`). Из-за этого кнопка «Pošlji» перекрыта нижним меню и недоступна для нажатия.

**Approach:** Добавить `<article>` в `PostDetail` нижний отступ под высоту мобильного меню (`pb-[76px]`) и сбросить его на десктопе (`md:pb-6`), где меню скрыто (`md:hidden`). Это повторяет уже принятый в проекте паттерн `pb-[60px] md:pb-0` из `FeedPageClient` и `ProfileScreen`.

## Suggested Review Order

1. [`src/components/feed/PostDetail.tsx:229`](../../src/components/feed/PostDetail.tsx) — изменён className корневого `<article>`: `py-6` → `pt-6 pb-[76px] md:pb-6`.
