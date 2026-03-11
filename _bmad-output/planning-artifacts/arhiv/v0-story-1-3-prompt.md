# Промт для v0.dev — Story 1.3: Публичный лендинг (Landing Page UI)

> **Статус истории:** ready-for-dev
> **Задача промта:** Итерация дизайна — лендинг уже реализован, но требует уточнений по story.
> **Ключевые исправления:** цены (€12,99/€34), carousel отзывов, отдельный PreviewPostCard.
> **Скопируй блок PROMPT целиком и вставь в https://v0.dev**

---

## КОНТЕКСТ ДЛЯ РАЗРАБОТЧИКА

Что уже есть в коде (не нужно создавать заново):
- `src/components/landing/HeroSection.tsx` ✅
- `src/components/landing/BenefitsSection.tsx` ✅
- `src/components/landing/PreviewPostsSection.tsx` ✅ (но PreviewPostCard встроен внутрь, нужен отдельный компонент)
- `src/components/landing/TestimonialsSection.tsx` ✅ (вертикальный список, нужна carousel/grid версия)
- `src/components/landing/PricingSection.tsx` ⚠️ (цена €29 — НЕВЕРНО, нужно €12,99/мес и €34/3мес)
- `src/components/landing/CtaSection.tsx` ✅
- `src/app/(public)/login/page.tsx` ✅

Что нужно исправить/добавить по story:
1. **PricingSection** — цены €12,99/мес и €34/3 месяца (согласно PRD)
2. **PreviewPostCard** — отдельный reusable компонент
3. **TestimonialsSection** — вариант с горизонтальным carousel (mobile-friendly)
4. **HeroSection** — кнопки адаптированы к состоянию авторизации

---

## PROMPT

```
I need to iterate on a landing page design for PROCONTENT — a premium closed membership club for female content creators in Slovenia. The app is built with Next.js 16 + Tailwind CSS v4 + App Router.

Please generate an updated, production-quality mobile-first landing page. The base design already exists — I need specific improvements detailed below.

---

## EXISTING DESIGN SYSTEM (must match exactly)

### Fonts
- **Headings:** Cormorant Garamond — elegant serif. Usage: large uppercase titles, font-light, clamp sizes.
- **UI/Body:** Barlow Condensed — condensed sans-serif. Usage: buttons, labels, body text, always uppercase with tracking-[0.15em]–[0.3em].

### CSS Color Tokens
```css
--background: oklch(0.993 0.006 90);       /* warm cream */
--foreground: oklch(0.22 0.01 60);         /* warm dark charcoal */
--primary: oklch(0.56 0.1 35);             /* muted terracotta */
--primary-foreground: oklch(0.993 0.006 90);
--muted: oklch(0.96 0.005 80);
--muted-foreground: oklch(0.52 0.012 60);
--border: oklch(0.91 0.01 80);
--card: oklch(0.993 0.006 90);
```

### Button Style (editorial outline — NO filled buttons ever)
```
border border-primary px-8 py-3 font-sans text-xs font-medium tracking-[0.2em] uppercase
hover:bg-primary/10 transition-colors min-h-[44px]
```

---

## FULL PAGE STRUCTURE

Show the complete landing page in mobile viewport (375px width). The page has these sections in order:

### SECTION 1: HERO (already good, keep as is)
- `min-h-[100svh]` full-screen dark section with `bg-foreground`
- Background: warm dark gradient (foreground color) with subtle texture overlay
- Logo top-left: "PROCONTENT" in `font-sans text-sm tracking-[0.2em] uppercase text-primary-foreground/80`
- Small label: "Закрытый клуб" in terracotta tint `oklch(0.75 0.1 35)`, `text-[10px] tracking-[0.3em] uppercase`
- Giant headline: "PRO" / "CONTENT" split on 2 lines — `font-serif font-light uppercase clamp(3rem,12vw,6rem) leading-none text-primary-foreground`
- Subheading: `font-sans text-xs tracking-[0.15em] uppercase text-primary-foreground/70`
  "База знаний, живое комьюнити и оффлайн-встречи для создательниц контента в Словении."
- Two CTA buttons (stacked on mobile):
  1. "Вступить в клуб" — `border border-primary text-primary-foreground hover:bg-primary/20`
  2. "Посмотреть превью" — `border border-primary-foreground/30 text-primary-foreground/60`

---

### SECTION 2: BENEFITS (already good, keep as is)
- `bg-background px-5 py-16`
- Label: "Что внутри" — `text-xs tracking-[0.3em] uppercase text-primary`
- Title: "Всё для роста" — `font-serif font-light uppercase clamp(2rem,8vw,3.5rem) leading-none`
- 4 benefit rows (icon-left layout):
  - Icon in `size-10 rounded-xl bg-primary/10 flex items-center justify-center`
  - Icon: `size-5 text-primary` (BookOpen, Users, Zap, Archive from lucide-react)
  - Title: `font-serif text-xl font-light uppercase tracking-wide`
  - Description: `text-xs tracking-[0.1em] uppercase text-muted-foreground leading-relaxed`

  Items:
  1. BookOpen — "2 года базы знаний" / "Сотни постов по съёмке, алгоритмам и работе с брендами — фильтруй по теме в один тап."
  2. Users — "Своё комьюнити" / "WhatsApp-чат, где можно задать «глупый» вопрос и получить честный ответ без осуждения."
  3. Zap — "Живые разборы" / "Разбор профилей, трендов и кейсов каждую неделю — чтобы применять знания сразу."
  4. Archive — "Оффлайн-встречи" / "Нетворкинг и коллаборации с другими создательницами контента в Словении."

---

### SECTION 3: PREVIEW POSTS ⭐ NEEDS IMPROVEMENT
This section shows 3 content preview cards. Show a **standalone reusable PreviewPostCard component** (not inlined).

**Section wrapper:** `bg-muted/40 px-5 py-16`
- Label: "Превью контента" — `text-xs tracking-[0.2em] uppercase text-primary`
- Title: "Загляни внутрь" — `font-heading text-2xl font-semibold leading-snug`
- Subtitle: "Каждую неделю — новые разборы, инсайты и практические гайды." — `text-sm text-muted-foreground`

**PreviewPostCard component** (export as a reusable component separately):
Props: `{ category, title, excerpt, date, likes, comments, isLocked }`

Card layout: `rounded-2xl border border-border bg-card p-5`
- Header row: category pill `rounded-full bg-primary/10 px-3 py-1 text-xs text-primary` + date `text-xs text-muted-foreground`
- Title: `font-heading text-base font-semibold leading-snug text-balance text-foreground`
- Excerpt:
  - If NOT locked: `text-sm leading-relaxed text-muted-foreground line-clamp-2`
  - If locked: 1 line visible + `bg-gradient-to-r from-transparent to-card absolute inset-0` fade overlay
- Footer social: Heart icon + likes count · MessageCircle icon + comments count — `text-xs text-muted-foreground`, buttons `min-h-[44px]`
- If locked: Lock icon + "Для участниц" badge right-aligned in `text-primary text-xs`

**3 cards with this data:**
1. `category: "#insight"`, `title: "Почему алгоритм Reels продвигает одних и игнорирует других"`, `excerpt: "Разобрали механику ранжирования коротких видео: что реально влияет на охваты, а что — миф."`, `date: "12 фев"`, `likes: 47`, `comments: 12`, `isLocked: false`
2. `category: "#разборы"`, `title: "UGC-портфолио: как собрать первые 5 кейсов без бюджета"`, `excerpt: "Пошаговый гайд: от выбора ниши до питча бренду. Включает шаблон письма."`, `date: "8 фев"`, `likes: 83`, `comments: 24`, `isLocked: true`
3. `category: "#съёмка"`, `title: "Свет в помещении: 3 расстановки для контента с телефона"`, `excerpt: "Кольцевой свет — не единственный вариант. Показываем, как работать с естественным светом."`, `date: "1 фев"`, `likes: 61`, `comments: 18`, `isLocked: true`

---

### SECTION 4: TESTIMONIALS (keep existing vertical list — no changes needed)

**Section wrapper:** `bg-background px-5 py-16`
- Label: "Отзывы" — `text-xs tracking-[0.3em] uppercase text-primary`
- Title: "Что говорят" — `font-serif font-light uppercase clamp(2rem,8vw,3.5rem) leading-none`

**Vertical list of 3 blockquote cards** (existing implementation is correct):
Each card: `rounded-2xl border border-border bg-card p-5`

Structure per card:
- Quote: `font-serif text-foreground text-lg font-light leading-snug italic`
- Avatar: `rounded-full bg-primary/20 size-9 flex items-center justify-center text-xs font-semibold text-primary`
- Name: `text-xs font-medium tracking-[0.15em] uppercase text-foreground`
- Badge: `rounded-full bg-primary/10 px-2 py-0.5 text-xs uppercase tracking-wide text-primary`
- Role: `text-xs tracking-[0.1em] uppercase text-muted-foreground`

Data:
1. Avatar: "М" · Name: "Маша К." · Badge: "Опытная" · Role: "UGC-криэйтор"
   Quote: "За 3 месяца в клубе подписала контракты с 4 брендами. База знаний — это моя тайная суперсила."
2. Avatar: "А" · Name: "Аня Р." · Badge: "Участница" · Role: "Начинающий контент-мейкер"
   Quote: "Наконец-то нашла место, где можно задать вопрос без страха быть осуждённой. Комьюнити — огонь!"
3. Avatar: "Л" · Name: "Лена В." · Badge: "Участница" · Role: "Владелица малого бизнеса"
   Quote: "Научилась снимать контент для своего кафе сама. Теперь не трачу деньги на SMM-агентство."

---

### SECTION 5: PRICING ⭐ CRITICAL FIX — WRONG PRICES IN CURRENT CODE
Current code shows €29/мес — THIS IS WRONG. Story requires: **€12,99/месяц** and **€34/3 месяца**.

**Section wrapper:** `bg-muted/40 px-5 py-16`
- Label: "Вступление" — `text-xs tracking-[0.3em] uppercase text-primary`
- Title: "Всё включено" — `font-serif font-light uppercase clamp(2rem,8vw,3.5rem) leading-none`
- Subtitle: "Никаких скрытых платежей. Отменить можно в любой момент." — `text-xs tracking-[0.1em] uppercase text-muted-foreground`

**Two pricing options side by side (or stacked on mobile):**

Option 1 card: `rounded-2xl border border-border bg-card p-5`
- Badge: "Ежемесячно" — `text-[10px] tracking-[0.15em] uppercase text-muted-foreground`
- Price: "€12,99" — `font-serif text-5xl font-light leading-none text-foreground`
- Period: "/ месяц" — `text-xs tracking-[0.15em] uppercase text-muted-foreground mb-1`
- CTA button: "Вступить" — full-width outline primary style

Option 2 card: `rounded-2xl border border-primary/30 bg-card p-5` (slightly highlighted)
- Badge: "3 месяца" — PLUS savings badge `rounded-full bg-primary/10 text-primary text-[10px] px-2 py-0.5` showing "Экономия €4,97"
- Price: "€34" — `font-serif text-5xl font-light leading-none text-foreground`
- Period: "/ 3 месяца" — `text-xs tracking-[0.15em] uppercase text-muted-foreground`
- Subtext: "≈ €11,33 в месяц" — `text-[10px] text-muted-foreground`
- CTA button: "Выбрать" — full-width outline primary style, slightly more prominent

**Features checklist below both options** (applies to both plans):
`border-t border-border mt-6 pt-6` separator, then ul with Check icons `text-primary size-4`:
- Полный доступ к базе знаний (2+ года контента)
- Еженедельные разборы и лайв-сессии
- Чат комьюнити в WhatsApp
- Оффлайн-встречи в Словении
- Шаблоны, чек-листы и скрипты
- Ответы автора в комментариях

Below checklist: `text-center text-xs text-muted-foreground` — "Безопасная оплата через Stripe · Отмена в 1 клик."

---

### SECTION 6: CTA (already good, keep as is)
- `bg-foreground px-5 py-16` — dark inverted section
- Label: "Готова?" — in terracotta tint `oklch(0.75 0.1 35)`, `text-xs tracking-[0.3em] uppercase`
- Title: "Твоё новое окружение" — `font-serif text-primary-foreground font-light uppercase clamp(2.5rem,10vw,5rem) leading-none`
- Subtitle: "Присоединяйся к закрытому клубу создательниц контента и начни расти вместе." — `text-primary-foreground/60 text-xs tracking-[0.15em] uppercase`
- CTA button: "Вступить в клуб" — `border border-primary text-primary-foreground hover:bg-primary/20` min-h-[44px]
- Text link: "Уже участница? Войти" — `text-primary-foreground/40 text-xs` + underline link

---

## ADDITIONAL: LOGIN PAGE (show as separate frame)

Show the `/login` page design in a second mobile frame alongside the landing page.

**Layout:** `min-h-screen flex items-center justify-center bg-background px-4 py-12`
**Container:** `w-full max-w-sm`

**State 1 — Email step:**
- Back link: "← Назад" — `text-xs tracking-[0.15em] uppercase text-muted-foreground` (links to `/`)
- Label: "Доступ в клуб" — `text-[10px] tracking-[0.3em] uppercase text-primary`
- Title: "Войти" — `font-serif font-light uppercase text-[clamp(2.5rem,8vw,3rem)] leading-none text-foreground`
- Subtitle: "Мы отправим код на ваш email" — `text-xs tracking-[0.1em] uppercase text-muted-foreground`
- Email input: `border border-border rounded-lg px-4 py-3 text-sm w-full focus:ring-2 focus:ring-primary/20 bg-background` placeholder "your@email.com"
- Submit button: "Получить код" — full-width outline primary style, `min-h-[44px]`

**State 2 — OTP step (show as second variant):**
- Back link: "← Изменить email"
- Title: "Введи код" — same serif style
- Subtitle: "Отправили на your@email.com" — `text-xs text-muted-foreground`
- OTP input: `border border-border rounded-lg px-4 py-3 text-center text-2xl tracking-[0.5em] w-full font-sans` placeholder "000000"
- Submit button: "Войти" — full-width outline primary
- Resend link: "Отправить повторно" — `text-xs text-primary underline-offset-4 hover:underline`

**Error state variant:** Show inline error `text-destructive text-sm mt-1` under input + `border-destructive` on input border.

---

## STRICT DESIGN RULES

✅ DO:
- Mobile-first, 375px viewport width for all frames
- Use CSS variables (--primary, --background, etc.) not hardcoded colors
- Every interactive element: `min-h-[44px] min-w-[44px]` touch target
- Outline-only buttons (no solid fills)
- `font-serif` for editorial headings (Cormorant Garamond)
- `font-sans` for UI/labels (Barlow Condensed)
- Uppercase text everywhere with appropriate letter-spacing
- Rounded cards `rounded-2xl`
- WCAG AA contrast

❌ DON'T:
- No filled/solid button backgrounds
- No pure #fff or #000 — use warm cream/charcoal
- No hamburger menus
- No modal popups breaking the flow
- No box shadows (use border instead)
- No Material/Bootstrap patterns
- No lowercase body text (always uppercase for UI labels)

---

## OUTPUT REQUESTED

1. **Full landing page** — complete mobile view (375px), all 6 sections scrollable
2. **Standalone PreviewPostCard** — show the component in both locked and unlocked states
3. **Login page** — both states: email step + OTP step
4. **Pricing section closeup** — the corrected two-option pricing (€12,99 / €34) in detail
```

---

## Что изменяется по сравнению с текущей реализацией

| Компонент | Текущее состояние | Требование story 1.3 |
|-----------|-------------------|----------------------|
| `PricingSection` | €29/мес ⚠️ | **€12,99/мес + €34/3 мес** |
| `PreviewPostCard` | Встроен в секцию | Отдельный reusable компонент |
| `TestimonialsSection` | Вертикальный список ✅ | Оставить как есть |
| Структура файлов | `src/components/landing/` | `src/features/landing/components/` |
| `page.tsx` | `src/app/page.tsx` | `src/app/(public)/page.tsx` |

---

## Уточняющие промты для итерации в v0.dev

**Цены:**
> "The pricing section must show €12,99/month AND €34/3 months as two separate plan cards side by side. The 3-month plan should be slightly highlighted. Current code shows €29 which is wrong."

**PreviewPostCard:**
> "Extract the PostPreviewCard into a standalone reusable component with props: category, title, excerpt, date, likes, comments, isLocked. Show it exported separately."

**Типографика:**
> "The heading font is Cormorant Garamond — make it feel more luxurious and editorial. Increase font size and ensure font-light weight."

---

## Связанные файлы

- Story: `_bmad-output/implementation-artifacts/stories/1-3-public-landing-landing-page-ui.md`
- UX Spec: `_bmad-output/planning-artifacts/ux-design-specification.md`
- Существующие компоненты: `src/components/landing/`
- Auth компоненты: `src/features/auth/components/`
