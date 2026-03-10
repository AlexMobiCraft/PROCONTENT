# Story 1.3: Публичный лендинг (Landing Page UI)

Status: in-progress

## Story

As a незарегистрированная посетительница,
I want видеть ценностное предложение, отзывы и превью-посты на главной странице,
So that понять ценность комьюнити перед покупкой.

## Acceptance Criteria

1. **Given** неавторизованный доступ к корню сайта (`/`)
   **When** загружается страница
   **Then** отображается лендинг с дизайном "Mobile-First"
   **And** видны блок с отзывами и статичные карточки превью-постов

2. **Given** авторизованная участница (с активной сессией)
   **When** она открывает корень сайта (`/`)
   **Then** лендинг всё равно доступен, но в верхней навигации или кнопках Call to Action отображается "Перейти в ленту" вместо "Вступить" (или middleware редиректит её на `/feed`, если таково поведение по умолчанию — в соответствии с PRD лендинг для *незарегистрированных*, поэтому для авторизованных допустим редирект или изменение кнопок). *Уточнение*: следуем простой логике — отображаем кнопки "Войти" на ленди
   нге.

3. **Given** статичные карточки превью-постов
   **When** они рендерятся на мобайле
   **Then** используется `<Image />` из Next.js для соблюдения LCP ≤ 2.5 сек (NFR1)
   **And** карточки выглядят консистентно (единый стиль, закругления rounder-xl, отступы).

4. **Given** блок с отзывами
   **When** пользователь скроллит страницу
   **Then** отзывы представлены в удобочитаемом виде (вертикальный список карточек, Mobile-first).
   **And** реализация — `<blockquote>` карточки с аватаром-инициалом, именем, бейджем статуса и serif-цитатой.

## Tasks / Subtasks

- [x] Task 1: Подготовка Layout и структуры публичной зоны
  - [x] Subtask 1.1: Страница оставлена в `src/app/page.tsx` (корневой маршрут). Перенос в `(public)/page.tsx` не требуется — роутинг работает корректно.
  - [x] Subtask 1.2: Метаданные обновлены: title "PROCONTENT — Закрытый клуб для создателей контента", description заполнен.

- [ ] Task 2: Создание Dumb-компонентов UI для Лендинга
  - [x] Subtask 2.1: `src/components/landing/HeroSection.tsx` — реализован. Кнопки "Вступить в клуб" (→ `#pricing`) и "Посмотреть превью" (→ `#preview`). Авторизованные видят те же кнопки, редирект на `/feed` выполняет layout через Supabase auth guard.
  - [ ] Subtask 2.2: **PENDING** — `PreviewPostCard` встроен инлайн в `PreviewPostsSection.tsx`. Нужно вынести в отдельный файл `src/components/landing/PreviewPostCard.tsx` с props-интерфейсом `{ category, title, excerpt, date, likes, comments, isLocked }`.
  - [x] Subtask 2.3: `src/components/landing/TestimonialsSection.tsx` — реализован. Вертикальный список из 3 `<blockquote>` карточек со статическими данными.
  - [ ] Subtask 2.4: **PENDING — КРИТИЧНО** — `src/components/landing/PricingSection.tsx` реализован, но цена указана **€29/мес**, что не соответствует PRD. Нужно исправить на **два тарифа: 12,99€/мес и 34€/3 мес** с двумя отдельными CTA. Кнопки → `/login` (Stripe Checkout в Story 1.4).

- [x] Task 3: Сборка статической страницы Лендинга
  - [x] Subtask 3.1: Страница собрана в `src/app/page.tsx`. Порядок секций: Hero → Benefits → PreviewPosts → Testimonials → Pricing → CTA.
  - [x] Subtask 3.2: Дизайн токены Warm Minimalism применены через CSS-переменные oklch в `globals.css`. Шрифты: Cormorant Garamond (heading) + Barlow Condensed (sans). Кнопки — editorial outline стиль.
  - [x] Subtask 3.3: WCAG AA контраст соблюдён. Touch targets `min-h-[44px] min-w-[44px]` на всех интерактивных элементах.

- [x] Task 4: Защита и навигация для авторизованных
  - [x] Subtask 4.1: Кнопки на лендинге отображают "Вступить в клуб" и "Войти". Авторизованные участницы перенаправляются на `/feed` через `(app)/layout.tsx` auth guard (Supabase server-side check). Клиентская гидратация кнопок не требуется.

- [ ] Task 5: Написание тестов
  - [ ] Subtask 5.1: **PENDING** — Unit-тесты не написаны. Покрыть: `HeroSection`, `PreviewPostCard` (после выноса в отд. файл), `TestimonialsSection`. Проверить рендер без ошибок, alt тексты, touch targets.

## Dev Notes

- **UX/Визуальный дизайн (реализовано):**
  - Направление: "Warm Minimalism". CSS-переменные oklch в `src/app/globals.css`: `--background: oklch(0.993 0.006 90)` (тёплый крем), `--foreground: oklch(0.22 0.01 60)` (тёплый чёрный), `--primary: oklch(0.56 0.1 35)` (muted terracotta).
  - Кнопки — editorial outline стиль (`border border-primary`, NO filled). Hover: `bg-primary/10`.
  - Скругления для карточек: `rounded-2xl`. Отступы 8pt grid: `p-5`, `gap-4`, `py-16`.
  - Шрифты: `font-serif` = Cormorant Garamond, `font-sans` = Barlow Condensed (через `next/font/google`).
- **Производительность (NFR1&NFR2):**
  - Лендинг — Server Component. `HeroSection` и `PricingSection` содержат `'use client'` только для кнопок-ссылок.
  - `<Image />` из `next/image` используется в `HeroSection` для `hero-bg.png` с `priority`.
  - PreviewPostCard — статические данные, без клиентской логики.
- **Интеграция со Stripe:** Кнопки "Вступить" → `/login` (заглушка). Реальные Stripe Checkout ссылки — Story 1.4. Цены: **12,99€/мес и 34€/3 мес** (PricingSection требует исправления — см. Subtask 2.4).
- Мок-посты захардкожены в `PreviewPostsSection.tsx` (3 поста: #insight, #разборы, #съёмка).
- Иконки: `lucide-react` (BookOpen, Users, Zap, Archive, Heart, MessageCircle, Lock, Check).

### Project Structure Notes

- Компоненты лендинга размещены в `src/components/landing/` (не в `features/`): HeroSection, BenefitsSection, PreviewPostsSection, TestimonialsSection, PricingSection, CtaSection.
- `PreviewPostCard` (pending): создать как `src/components/landing/PreviewPostCard.tsx`, импортировать в `PreviewPostsSection.tsx`.
- Страница: `src/app/page.tsx` — корневой маршрут, перенос в `(public)/` не требуется.
- Тесты: `tests/unit/components/landing/...`

### References

- [UX Design Specification - Phase 1.3](file:///c:/Users/tkachenko/DEV/PROCONTENT/_bmad-output/planning-artifacts/ux-design-specification.md)
- [Architecture Boundaries](file:///c:/Users/tkachenko/DEV/PROCONTENT/_bmad-output/planning-artifacts/architecture.md)
- Stripe Pricing (PRD): 12,99€ / 1 месяц, 34€ / 3 месяца.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Компоненты реализованы в `src/components/landing/` (не в `features/landing/`).
- `TestimonialsSection` — вертикальный список карточек (не carousel). Решение принято: carousel не нужен.
- `PricingSection` содержит ОШИБКУ: отображает €29/мес вместо €12,99/мес + €34/3 мес согласно PRD. Требует исправления в коде перед закрытием истории.
- `PreviewPostCard` не вынесен в отдельный файл — встроен в `PreviewPostsSection.tsx`. Требует рефакторинга.
- Unit-тесты не написаны.

### File List

- `src/app/page.tsx` — главная страница лендинга
- `src/components/landing/HeroSection.tsx`
- `src/components/landing/BenefitsSection.tsx`
- `src/components/landing/PreviewPostsSection.tsx` (содержит инлайн PreviewPostCard)
- `src/components/landing/TestimonialsSection.tsx`
- `src/components/landing/PricingSection.tsx` ⚠️ цена требует исправления
- `src/components/landing/CtaSection.tsx`
