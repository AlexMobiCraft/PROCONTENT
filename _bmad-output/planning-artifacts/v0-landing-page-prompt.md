# Промт для генерации дизайна Landing Page PROCONTENT в Vercel v0.dev

> **Назначение:** Готовый промт для Vercel v0.dev для генерации полного дизайна публичного лендинга платформы PROCONTENT.
> **Использование:** Скопируй содержимое секции «PROMPT» целиком и вставь в поле ввода на https://v0.dev

---

## PROMPT

```
Create a full landing page for PROCONTENT — a premium closed community (membership club) for Slovenian female content creators. The platform is a Next.js 16 + Tailwind CSS v4 app with App Router. Build a complete, beautiful, mobile-first landing page as a single React Server Component file.

---

## DESIGN SYSTEM

### Typography
- **Headings font:** Cormorant Garamond (serif) — elegant, high-contrast thin/thick strokes. Use for all H1/H2 titles. Always uppercase, font-light.
- **UI font:** Barlow Condensed (sans-serif) — condensed, fashion/editorial feel. Use for buttons, labels, navigation, body text. Always uppercase with wide letter-spacing (tracking-[0.15em] to tracking-[0.3em]).
- Import both from Google Fonts via next/font/google with cyrillic subset.

### Color Palette (CSS variables in oklch)
```css
--background: oklch(0.993 0.006 90);     /* warm cream, like paper — NOT pure white */
--foreground: oklch(0.22 0.01 60);       /* warm dark charcoal — NOT pure black */
--primary: oklch(0.56 0.1 35);           /* muted terracotta — accent color */
--primary-foreground: oklch(0.993 0.006 90); /* cream text on dark bg */
--muted: oklch(0.96 0.005 80);           /* subtle warm gray bg */
--muted-foreground: oklch(0.52 0.012 60); /* secondary text */
--border: oklch(0.91 0.01 80);           /* warm thin separator */
--card: oklch(0.993 0.006 90);           /* same as background */
```
Apply these as Tailwind CSS variables via @theme inline.

### Buttons (editorial outline style — NO filled buttons)
- **Primary CTA:** `border border-primary px-8 py-3 font-sans text-xs font-medium tracking-[0.2em] uppercase hover:bg-primary/10 transition-colors min-h-[44px]`
- **Secondary CTA (on dark bg):** `border border-primary-foreground/30 text-primary-foreground/60 px-8 py-3 font-sans text-xs tracking-[0.2em] uppercase hover:border-primary-foreground/60 transition-colors min-h-[44px]`
- **Text link:** `text-primary underline-offset-4 hover:underline text-xs tracking-[0.15em] uppercase`
- NEVER use filled/solid button backgrounds. Always outline style.

### Spacing & Layout
- 8pt grid: gap-1 (4px), gap-2 (8px), gap-4 (16px), gap-6 (24px), gap-8 (32px)
- Section padding: py-16 (64px) on mobile
- Content max-width: max-w-xl (576px) centered
- Card border-radius: rounded-2xl (16px)
- Mobile-first. Base styles for 375px+, tablet md:, desktop lg:

---

## PAGE SECTIONS (in order)

### 1. HERO SECTION
Full screen (min-h-[100svh]) with dark overlay.

**Layout:**
- Background: full-bleed image placeholder (use a warm dark gradient as fallback: `bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900`)
- Dark overlay: `bg-foreground/70` overlay on top of image
- Content centered vertically and horizontally with flex column
- Inverted color scheme: background is dark (`bg-foreground`), text is `text-primary-foreground`

**Content:**
- Small uppercase label: "Закрытый клуб для создательниц контента" — `font-sans text-[10px] tracking-[0.3em] uppercase text-primary-foreground/60 mb-6`
- Giant headline split on two lines:
  - Line 1: "PRO" — `font-serif font-light uppercase leading-none` at `clamp(4rem, 15vw, 8rem)`
  - Line 2: "CONTENT" — same style
  - Both lines have a small muted terracotta accent dot or dash between them
- Subtitle: "Профессиональное комьюнити. Эксклюзивные знания. Реальные результаты." — `font-sans text-xs tracking-[0.15em] uppercase text-primary-foreground/70 mt-6 mb-10`
- Two CTA buttons side by side (or stacked on mobile):
  - Primary: "Вступить в клуб" (outline style, `border-primary-foreground`)
  - Secondary: "Посмотреть превью" (ghost outline, `border-primary-foreground/30`)
- Small text below buttons: "от 12,99€ / мес · Отмена в любой момент" — `text-[10px] tracking-[0.2em] uppercase text-primary-foreground/40 mt-4`

**Bottom of hero:** Thin scroll indicator arrow (animated chevron-down icon from lucide-react)

---

### 2. BENEFITS SECTION
Light background (`bg-background`). Showcase 4 key platform benefits.

**Header:**
- Label: "Что вы получаете" — `font-sans text-[10px] tracking-[0.3em] uppercase text-muted-foreground`
- Title: "Клуб, который работает" — `font-serif font-light uppercase` at `clamp(2rem, 8vw, 3.5rem)`

**4 benefit cards in 2×2 grid (md: 4 columns):**
Each card: `border border-border rounded-2xl p-6 bg-card`

Card 1 — BookOpen icon (lucide):
- Label: "База знаний"
- Description: "2+ года структурированного контента по UGC, Reels, брендам и алгоритмам — доступно по рубрикам в один клик"

Card 2 — Users icon:
- Label: "Живое комьюнити"
- Description: "Закрытый WhatsApp-чат с другими создательницами и прямой доступ к основательнице"

Card 3 — Zap icon:
- Label: "Практические инсайты"
- Description: "Разборы кейсов, разбор алгоритмов, шаблоны — применяй сегодня вечером"

Card 4 — Archive icon:
- Label: "Оффлайн-встречи"
- Description: "Регулярные встречи в Словении для участниц клуба"

Card styles: Label `font-serif uppercase text-lg font-light mb-2`, Description `font-sans text-xs tracking-[0.1em] uppercase text-muted-foreground leading-relaxed`, Icon `text-primary w-5 h-5 mb-4`

---

### 3. PREVIEW POSTS SECTION
Show what content looks like inside. Mock 3 content preview cards.

**Header:**
- Label: "Превью контента" — small uppercase label
- Title: "Загляни внутрь" — `font-serif font-light uppercase clamp(2rem, 8vw, 3.5rem)`
- Subtitle: "Реальные посты из закрытого клуба" — muted small text

**3 preview cards (vertical stack on mobile, md: 3 columns):**
Each card: `rounded-2xl border border-border bg-card p-5 relative overflow-hidden`

Card 1 (OPEN — visible):
- Category pill: "#insight" — `bg-primary/10 text-primary rounded-full px-3 py-1 text-[10px] tracking-[0.15em] uppercase font-sans`
- Title: "Разбор: как я сняла UGC за 2 часа и заработала €800"
- Excerpt (3 lines, clamp): "Конкретная пошаговая схема работы с брендом от питча до сдачи материалов. Без воды и теории..."
- Footer: Like icon (Heart) + count "24" · Comment icon + count "8" — muted small text, min-h-[44px] buttons

Card 2 (LOCKED — blurred bottom half):
- Category pill: "#reels"
- Title: "5 хуков для Reels, которые дали мне 100k охвата"
- Excerpt showing but with gradient fade overlay at bottom: `bg-gradient-to-b from-transparent to-card absolute bottom-0`
- Lock badge overlay at bottom: `Lock icon + "Только для участниц"` — centered, `bg-primary/10 text-primary border border-primary/20 rounded-full px-4 py-2 text-xs tracking-[0.15em] uppercase`

Card 3 (LOCKED):
- Category pill: "#бренды"
- Title: "Письмо бренду: шаблон, который конвертирует в 40% случаев"
- Same locked state as Card 2

---

### 4. TESTIMONIALS SECTION
Warm background (`bg-muted/50`). Social proof with 3 testimonials.

**Header:**
- Label: "Отзывы участниц"
- Title: "Говорят о клубе" — `font-serif font-light uppercase clamp(2rem, 8vw, 3.5rem)`

**3 testimonial cards in grid (md: 3 cols):**
Each: `bg-card border border-border rounded-2xl p-6`

Card 1:
- Avatar: Circle with initials "АK" — `rounded-full bg-primary/20 w-10 h-10 flex items-center justify-center text-xs font-semibold text-primary`
- Name: "Ана К." — `font-sans text-xs tracking-[0.15em] uppercase`
- Badge: "Опытная" — `bg-primary/10 text-primary text-[10px] tracking-[0.1em] uppercase rounded-full px-2 py-0.5`
- Quote (blockquote, italic, serif): "За 3 месяца в клубе я подписала 4 бренда. Структурированная база знаний и поддержка комьюнити изменили подход к работе полностью."

Card 2:
- Initials: "МR"
- Name: "Maja R."
- Badge: "Участница"
- Quote: "Наконец-то нашла место, где можно задать 'глупый' вопрос и получить честный ответ. Чувствую себя частью своих."

Card 3:
- Initials: "TP"
- Name: "Teja P."
- Badge: "Участница"
- Quote: "Пришла как владелица малого бизнеса, чтобы снимать контент сама. Теперь наш Instagram растёт на 2k подписчиков в месяц."

---

### 5. PRICING SECTION
Light background. Simple, one pricing option.

**Header:**
- Label: "Тариф"
- Title: "Простая цена. Полный доступ." — `font-serif font-light uppercase clamp(2rem, 8vw, 3.5rem)`

**Single pricing card (centered, max-w-sm mx-auto):**
`border border-border rounded-2xl p-8 bg-card`

- Two plan cards side by side (stacked on mobile):
  - Plan 1: "€12,99" — `font-serif font-light text-5xl leading-none` + "/месяц"
  - Plan 2: "€34" — `font-serif font-light text-5xl leading-none` + "/3 месяца" with savings badge: "Экономия €4,97" in `bg-primary/10 text-primary rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.15em]`
  - Subtext for plan 2: "≈ €11,33 в месяц"
- Divider line: `border-t border-border my-6`
- Feature checklist (6 items with Check icon from lucide):
  1. Весь архив постов (2+ года контента)
  2. Фильтрация по рубрикам: insight, reels, бренды и др.
  3. Закрытый WhatsApp-чат комьюнити
  4. Оффлайн-встречи в Словении
  5. Прямой доступ к основательнице
  6. Отмена подписки в любой момент
- Each item: `flex items-center gap-3 font-sans text-xs tracking-[0.1em] uppercase`
- Check icon: `text-primary w-4 h-4 flex-shrink-0`
- CTA button below: "Вступить сейчас" — full width, primary outline style
- Note below button: `text-[10px] tracking-[0.15em] uppercase text-muted-foreground text-center mt-3` — "Безопасная оплата через Stripe · Отмена онлайн"

---

### 6. FINAL CTA SECTION
Dark inverted section to close the page.

**Layout:**
- Background: `bg-foreground` (dark charcoal)
- Text: `text-primary-foreground`
- Full width, py-24, centered content

**Content:**
- Small label: "Присоединяйся" — `font-sans text-[10px] tracking-[0.3em] uppercase text-primary-foreground/40`
- Giant heading: "Твоё место уже ждёт" — `font-serif font-light uppercase` at `clamp(2.5rem, 10vw, 5rem) leading-none`
- Subtext: "Более 50 создательниц уже внутри. Следующий шаг — за тобой." — `font-sans text-xs tracking-[0.15em] uppercase text-primary-foreground/60 mt-4 mb-10`
- Primary CTA: "Вступить в клуб" — `border border-primary-foreground/60 text-primary-foreground px-10 py-4 font-sans text-xs tracking-[0.2em] uppercase hover:bg-primary-foreground/10 transition-colors min-h-[44px]`
- Text below: "Уже участница?" + link "Войти →" — `text-primary-foreground/40 text-[10px] tracking-[0.15em] uppercase mt-4`

---

### 7. FOOTER
Minimal footer.
- Logo: "PROCONTENT" in `font-serif font-light tracking-[0.3em] uppercase text-sm`
- Three small links: "Политика конфиденциальности" · "Условия использования" · "Контакт"
- Copyright: "© 2026 PROCONTENT. Все права защищены."
- All: `font-sans text-[10px] tracking-[0.15em] uppercase text-muted-foreground`

---

## HEADER / NAVBAR
Sticky top navigation (`sticky top-0 z-50 backdrop-blur-sm bg-background/90 border-b border-border`).

**Left:** Logo "PROCONTENT" — `font-serif font-light tracking-[0.3em] uppercase text-sm`
**Right (desktop):** Two links: "Войти" (text link) + "Вступить" (primary outline button small)
**Mobile:** Only logo + hamburger or "Войти" text link

---

## TECHNICAL REQUIREMENTS

- Use `'use server'` or `'use client'` appropriately — the main page should be a Server Component.
- Use `next/image` for any images (with placeholder skeleton or gradient fallback).
- Use `lucide-react` for all icons: `BookOpen, Users, Zap, Archive, Heart, MessageCircle, Lock, Check, ChevronDown`.
- All interactive elements: `min-h-[44px] min-w-[44px]` for touch targets.
- WCAG AA: ensure text contrast (no light gray on white).
- Smooth CSS transitions: `transition-colors duration-200` on buttons and links.
- Sections separated by `py-16 md:py-24`.
- Use `clamp()` for responsive typography (or Tailwind responsive prefixes).

---

## WHAT TO AVOID
- ❌ No filled/solid button backgrounds (always outline)
- ❌ No pure white (#fff) or pure black (#000) — use warm cream / warm charcoal
- ❌ No hamburger menu with hidden nav on mobile
- ❌ No popup modals or overlays
- ❌ No heavy shadows (flat design, use borders instead)
- ❌ No Material Design, Bootstrap, or Ant Design patterns

---

Generate the complete landing page as a single Next.js page component (or split into logical section components imported into page.tsx). Include all CSS variable definitions needed. Make it production-quality, beautiful, and conversion-optimized for a premium membership club targeting young female content creators.
```

---

## Советы по использованию промта

### Как применять
1. Перейди на https://v0.dev
2. Нажми **"New chat"** или **"Start building"**
3. Скопируй блок `PROMPT` выше (от первой ``` до последней ```)
4. Вставь целиком в поле ввода
5. Нажми Enter и дожидайся генерации

### Итеративные уточнения (после первой генерации)
Если результат требует правок, используй эти уточняющие промты:

**Типографика:**
> "Make the heading font Cormorant Garamond more prominent. The H1 should feel like a luxury fashion magazine — very large, light weight, ultra-wide letter-spacing."

**Цвета:**
> "The terracotta accent color (#primary) should feel muted and warm, not orange. Adjust to be more like a dusty rose-terracotta."

**Hero:**
> "Make the Hero section more dramatic. The background should be very dark, the text should feel like it's floating in dark space."

**Карточки превью:**
> "The locked content card should have a stronger blur/fade effect with a more prominent lock indicator."

**Кнопки:**
> "All buttons must be outline style only — NO filled backgrounds. The border should be thin and elegant."

---

## Связанные артефакты
- [Story 1.3 — Landing Page UI](../implementation-artifacts/stories/1-3-public-landing-landing-page-ui.md)
- [UX Design Specification](./ux-design-specification.md)
