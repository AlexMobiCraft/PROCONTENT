# Story 2.2: Оптимизированное отображение медиа в карточках (LazyMediaWrapper)

## Статус
- [ ] Отработка в спринте: Epic 2
- [ ] Приоритет: Medium
- [ ] Статус: ready-for-dev

## Контекст
Участницы просматривают ленту с большим количеством фото и видео. Для соблюдения NFR1 (LCP ≤ 2.5с) и NFR4 (загрузка фото ≤ 1с) необходимо откладывать загрузку тяжелых медиа до момента их появления в viewport и использовать CDN-оптимизацию Next.js.

## Acceptance Criteria
- [ ] **AC 1: Отложенная загрузка.** Медиа (фото/видео) загружаются только при приближении к viewport (200px margin).
- [ ] **AC 2: Плейсхолдер.** Вместо еще не загруженного медиа отображается скелетон или мягкий серый фон с сохранением пропорций (aspect-ratio).
- [ ] **AC 3: Оптимизация Next.js.** Все изображения проходят через Image Optimization API (WebP/AVIF, resizing).
- [ ] **AC 4: Обработка видео.** Для видео-постов отображается превью-изображение, загружаемое лениво.

## Tasks
- [x] **Task 1: Исследование и настройка**
    - [x] Проверить `next.config.js` на наличие домена Supabase Storage в `images.remotePatterns`.
- [x] **Task 2: Реализация LazyMediaWrapper**
    - [x] Создать `src/components/media/LazyMediaWrapper.tsx` с использованием `IntersectionObserver`.
    - [x] Реализовать плавное появление (fade-in) после загрузки.
- [x] **Task 3: Обновление PostCard**
    - [x] Добавить отрисовку `LazyMediaWrapper` в `PostCard.tsx` при наличии `imageUrl`.
    - [x] Обеспечить фиксированный aspect-ratio (например, 16/9 или 4/5) для предотвращения прыжков верстки (layout shift).
- [ ] **Task 4: Тестирование**
    - [ ] Написать unit-тест для `LazyMediaWrapper` (проверка вызова `observe`).
    - [ ] Визуальная проверка CLS (Cumulative Layout Shift) в Lighthouse/DevTools.

## File List
- `src/components/media/LazyMediaWrapper.tsx` (new)
- `src/components/feed/PostCard.tsx` (modify)
- `next.config.ts` (modify)

## Dev Notes
- Использовать стандартный `next/image` для фото.
- Для видео на этапе MVP используем `imageUrl` как постер (poster image).
- Библиотека `framer-motion` приветствуется для анимации появления.
