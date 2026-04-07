---
title: 'Increase Post Font Sizes'
type: 'feature'
created: '2026-04-07'
status: 'done'
baseline_commit: 'bf5ea4ab3448726f7982c9603327ad4c744e2261'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Текст в компонентах постов (карточка, детальный вид, редактор, форма создания, комментарии) слишком мелкий — это снижает читабельность при просмотре, создании контента и участии в обсуждениях.

**Approach:** Поднять каждый Tailwind text-size класс на одну ступень (`xs→sm`, `sm→base`, `base→lg`, `xl→2xl`) в восьми целевых компонентах: PostCard, PostDetail, TiptapEditor, PostForm, PostComposerPreview, CommentsList, CommentForm, DiscussionNode.

## Boundaries & Constraints

**Always:**
- Менять только text-size классы (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`)
- Использовать стандартный Tailwind scale: xs→sm, sm→base, base→lg, lg→xl, xl→2xl
- Сохранять responsive-варианты (например, `md:text-lg` → `md:text-xl`)
- Не трогать `font-weight`, `line-height`, `letter-spacing`, цвета
- Затрагивать только компоненты постов и комментариев — карточка, детальный вид, редактор, форма создания, превью, список комментариев, форма комментария, узел обсуждения

**Ask First:**
- Если после увеличения h1 заголовка в PostDetail (text-xl → text-2xl) возникает overflow на мобильных
- Если в PostCard excerpt текст начинает сильно переноситься и обрезаться при расширении до text-base

**Never:**
- Вносить inline-styles
- Изменять базовые размеры шрифтов в `globals.css`
- Трогать компоненты категорий, навигации, admin-таблиц (вне скоупа)
- Изменять design system CSS-переменные

</frozen-after-approval>

## Code Map

- `src/components/feed/PostCard.tsx` — карточка поста в ленте: meta (text-xs), заголовок+excerpt+actions (text-sm)
- `src/components/feed/PostDetail.tsx` — детальный вид поста: meta (text-xs), автор (text-sm), заголовок h1 (text-xl)
- `src/features/editor/components/TiptapEditor.tsx` — WYSIWYG редактор: тело редактора и placeholder (text-sm), image label (text-xs)
- `src/features/admin/components/PostForm.tsx` — форма создания/редактирования: labels/inputs/meta (text-sm), errors/hints (text-xs), preview title (text-xl)
- `src/features/admin/components/PostComposerPreview.tsx` — превью при создании: label/excerpt (text-sm), hint (text-xs), preview title (text-xl)
- `src/features/comments/components/CommentsList.tsx` — список комментариев: empty state (text-sm)
- `src/features/comments/components/CommentForm.tsx` — форма комментария: кнопка отправки (text-xs), textarea (text-sm)
- `src/features/comments/components/DiscussionNode.tsx` — узел обсуждения: аватар, бейдж автора, дата (text-xs), имя автора, тело комментария (text-sm)

## Tasks & Acceptance

**Execution:**
- [x] `src/components/feed/PostCard.tsx` -- Заменить все `text-xs` → `text-sm` (meta: автор-бейдж, категория, дата, тип поста), `text-sm` → `text-base` (имя автора, заголовок h2, excerpt, кнопки лайков/комментариев) -- читабельность карточки в ленте
- [x] `src/components/feed/PostDetail.tsx` -- Заменить `text-xs` → `text-sm` (meta: категория, дата, кнопка назад), `text-sm` → `text-base` (имя автора, кнопка назад), `text-xl` → `text-2xl` (заголовок h1 поста) -- читабельность детального вида
- [x] `src/features/editor/components/TiptapEditor.tsx` -- Заменить `text-sm` → `text-base` (тело редактора, placeholder), `text-xs` → `text-sm` (label "Nastavitve slike") -- комфорт при наборе текста
- [x] `src/features/admin/components/PostForm.tsx` -- Заменить `text-xs` → `text-sm` (ошибки, подсказки, mode-buttons), `text-sm` → `text-base` (labels, select, input, meta), `text-xl` → `text-2xl` (preview title "Naslov objave") -- единообразие с PostCard/PostDetail
- [x] `src/features/admin/components/PostComposerPreview.tsx` -- Заменить `text-xs` → `text-sm` (подсказка), `text-sm` → `text-base` (label, excerpt, ошибки превью), `text-xl` → `text-2xl` (preview title) -- соответствие финальному виду поста
- [x] `src/features/comments/components/DiscussionNode.tsx` -- Заменить `text-xs` → `text-sm` (аватар, бейдж автора, дата, статусы), `text-sm` → `text-base` (имя автора, тело комментария) -- читабельность обсуждений
- [x] `src/features/comments/components/CommentForm.tsx` -- Заменить `text-xs` → `text-sm` (кнопка отправки), `text-sm` → `text-base` (textarea) -- комфорт при написании комментария
- [x] `src/features/comments/components/CommentsList.tsx` -- Заменить `text-sm` → `text-base` (empty state сообщение) -- единообразие с остальными компонентами

**Acceptance Criteria:**
- Given карточка поста в ленте, when пользователь просматривает ленту, then основной текст (заголовок, excerpt) отображается классом `text-base`, мета-информация — `text-sm`
- Given детальный вид поста, when пользователь читает пост, then заголовок h1 отображается классом `text-2xl`, мета-данные автора — `text-sm`
- Given WYSIWYG-редактор TiptapEditor, when пользователь набирает текст, then тело редактора использует `text-base`
- Given форма создания PostForm, when пользователь заполняет поля, then labels и поля ввода используют `text-base`
- Given превью PostComposerPreview, when пользователь смотрит превью, then заголовок отображается как `text-2xl`, что соответствует финальному PostDetail
- Given секция комментариев на странице поста, when пользователь читает обсуждение, then тело комментария отображается классом `text-base`, мета-данные (автор, дата) — `text-sm`

## Spec Change Log

## Design Notes

Tailwind scale step (~15-17% на каждый уровень):
```
text-xs   (12px) → text-sm   (14px)  +17%
text-sm   (14px) → text-base (16px)  +14%
text-base (16px) → text-lg   (18px)  +13%
text-xl   (20px) → text-2xl  (24px)  +20%
```
Итоговое увеличение укладывается в запрошенный диапазон 15-20%.

Тело поста (HTML из Tiptap), рендеримое в PostDetail, наследует базовые стили из `globals.css`, а не через явные text-классы — к нему это задание не применяется.

## Verification

**Commands:**
- `npm run typecheck` -- expected: no errors (text-классы не влияют на типы)
- `npm run lint` -- expected: no errors

**Manual checks (if no CLI):**
- В ленте `/feed`: заголовок карточки поста крупнее `text-base`, мета-информация `text-sm`
- На странице поста: h1 заголовок отображается как `text-2xl`
- В редакторе `/admin/posts/new`: тело редактора и labels выглядят крупнее прежнего
- На странице поста в секции комментариев: тело комментария `text-base`, дата/автор `text-sm`

## Suggested Review Order

**Читательский опыт (лента + детальный вид)**

- Главный заголовок поста: text-xl → text-2xl — крупнейший визуальный сдвиг
  [`PostDetail.tsx:260`](../../src/components/feed/PostDetail.tsx#L260)

- Excerpt в карточке ленты: text-sm → text-base, line-clamp-3 сохранён
  [`PostCard.tsx:224`](../../src/components/feed/PostCard.tsx#L224)

- Мета-строка карточки: author text-base, category/date stepped to text-sm
  [`PostCard.tsx:115`](../../src/components/feed/PostCard.tsx#L115)

- Мета-строка детального вида: author text-base, category/date text-sm
  [`PostDetail.tsx:222`](../../src/components/feed/PostDetail.tsx#L222)

**Комментарии**

- Тело комментария: text-sm → text-base с break-words
  [`DiscussionNode.tsx:140`](../../src/features/comments/components/DiscussionNode.tsx#L140)

- Мета автора и бейдж в комментарии: xs → sm
  [`DiscussionNode.tsx:116`](../../src/features/comments/components/DiscussionNode.tsx#L116)

- Textarea комментария и кнопка отправки: text-base / text-sm
  [`CommentForm.tsx:52`](../../src/features/comments/components/CommentForm.tsx#L52)

**Редактор и форма создания**

- Тело TiptapEditor: text-sm → text-base (строковый class в editorProps)
  [`TiptapEditor.tsx:129`](../../src/features/editor/components/TiptapEditor.tsx#L129)

- Labels и поля PostForm: все bumped на один шаг
  [`PostForm.tsx:357`](../../src/features/admin/components/PostForm.tsx#L357)

- Preview title в PostComposerPreview: xl → 2xl — соответствует PostDetail
  [`PostComposerPreview.tsx:41`](../../src/features/admin/components/PostComposerPreview.tsx#L41)
