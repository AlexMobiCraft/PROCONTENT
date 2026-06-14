---
title: 'Уведомление автора поста о новых комментариях'
type: 'feature'
created: '2026-06-14'
status: 'done'
baseline_commit: 'b0cdcb80813e2a07441b79cfdd342b232450511e'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Автор поста не узнаёт о новых комментариях — нет никакого уведомления, нужно проверять вручную.

**Approach:** После успешной вставки комментария клиент отправляет fire-and-forget запрос на новый route `/api/notifications/new-comment`. Route использует admin-клиент Supabase чтобы получить email автора поста и отправляет письмо через Resend с именем комментатора и ссылкой на пост. Если комментатор и есть автор — письмо не отправляется.

## Boundaries & Constraints

**Always:**
- Уведомление fire-and-forget: ошибка отправки не блокирует и не откатывает комментарий
- Не отправлять письмо если `comment.user_id === post.author_id`
- Использовать admin-клиент Supabase для чтения email автора (RLS не даёт читать чужие профили)
- Санитизировать все строки в HTML-шаблоне (escapeHtml)
- Имена отображать: `display_name` если есть, иначе `first_name + last_name`
- Route требует активную Supabase-сессию (авторизованный пользователь)
- Отправлять только если у автора есть email (`profiles.email IS NOT NULL`)

**Ask First:**
- Если понадобится добавить колонку в БД (например `comment_notifications_enabled`)

**Never:**
- Не добавлять подписку/отписку от комментариев (отдельная задача)
- Не проверять `email_notifications_enabled` — это поле только для массовых рассылок о новых постах подписчикам
- Не ждать результата отправки в клиентском коде (всегда fire-and-forget)
- Не использовать HTTP self-fetch из других server routes

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Новый комментарий от читателя | `post_id` → пост существует, автор ≠ комментатор, у автора есть email | Письмо отправлено автору | Ошибка логируется, 200 возвращается (partial-fail) |
| Автор комментирует свой пост | `post_id`, `commenter_id === author_id` | Письмо не отправляется, возврат `{ skipped: 'self' }` | N/A |
| У автора нет email | `author.email IS NULL` | Письмо не отправляется, возврат `{ skipped: 'no_email' }` | N/A |
| Пост не найден | `post_id` не существует в БД | HTTP 404 | — |
| Неавторизованный запрос | Нет сессии | HTTP 401 | — |

</frozen-after-approval>

## Code Map

- `src/lib/email/templates/new-comment.ts` -- новый шаблон письма (HTML + text)
- `src/lib/notifications/sendNewCommentNotification.ts` -- новая notification-функция (admin-клиент, логика пропуска)
- `src/app/api/notifications/new-comment/route.ts` -- новый POST route handler
- `src/features/comments/hooks/useComments.ts` -- fire-and-forget вызов после `insertPostComment`
- `src/lib/email/index.ts` -- переиспользуется `sendEmailBatch` и `EmailMessage`
- `src/lib/notifications/sendNewPostNotification.ts` -- образец паттерна (admin-клиент, env-guard)

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/email/templates/new-comment.ts` -- создать шаблон письма `generateNewCommentEmailHtml` / `generateNewCommentEmailText`. Данные: `postTitle`, `postUrl`, `commenterName`, `recipientName`. Визуальный язык — идентичен `new-post.ts` (Warm Minimalism): фон `#fefdf8`, основной текст `#1e1a16`, muted `#6e6762`, акцент/рамки `#a75d4b`, разделители `#e5e1da`; шрифт UI — Barlow Condensed (uppercase tracking-[0.22em]), заголовок поста — Cormorant Garamond serif 22px; CTA-кнопка editorial outline (`border:1px solid #a75d4b`, без заливки, hover не применим в email). Словенский текст: приветствие «Pozdravljeni, [recipientName]!», сообщение «[commenterName] je komentiral/-a vašo objavo:», заголовок поста в serif-блоке с левой рамкой `#a75d4b`, CTA «Poglej komentar». Подвал: информация без ссылки отписки (личное уведомление, не массовая рассылка).
- [x] `src/lib/notifications/sendNewCommentNotification.ts` -- создать `sendNewCommentNotification({ post_id, commenter_id, commenter_name })`. Использовать admin-клиент. Загрузить пост (`title`, `author_id`). Если `commenter_id === author_id` — вернуть `{ skipped: 'self' }`. Загрузить профиль автора (`email`, `display_name`, `first_name`, `last_name`). Если email пустой — вернуть `{ skipped: 'no_email' }`. Сформировать `postUrl`, вызвать `sendEmailBatch`. env-guard вне try/catch.
- [x] `src/app/api/notifications/new-comment/route.ts` -- создать POST handler. Проверить сессию (401 если нет). Принять body `{ post_id: string }`. Валидировать UUID. Вызвать `sendNewCommentNotification` с `commenter_id = user.id`, `commenter_name` из профиля текущего пользователя. Вернуть JSON результат.
- [x] `src/features/comments/hooks/useComments.ts` -- в `addComment`, после `replaceInTree` (успешный insert): вызвать `fetch('/api/notifications/new-comment', { method:'POST', body: JSON.stringify({ post_id: postId }), headers:{'Content-Type':'application/json'} })` без await (fire-and-forget, не обрабатывать ошибки в UI).

**Acceptance Criteria:**
- Given авторизованный пользователь оставил комментарий к чужому посту, when комментарий успешно сохранён в БД, then автор поста получает email с заголовком поста и кликабельной ссылкой на него
- Given автор поста комментирует свой собственный пост, when комментарий сохранён, then email автору НЕ отправляется
- Given у автора поста не задан email, when приходит комментарий, then API возвращает 200 с `{ skipped: 'no_email' }` без ошибки
- Given неавторизованный запрос к `/api/notifications/new-comment`, when POST без сессии, then ответ 401
- Given ошибка отправки Resend, when Resend возвращает ошибку, then комментарий в UI остаётся, ошибка логируется в консоль сервера, клиент не получает сигнала об ошибке

## Spec Change Log

## Design Notes

**Email visual language (Warm Minimalism):** Шаблон письма обязан полностью следовать дизайн-системе проекта (UX Design Spec, раздел «Color System» + «Typography System»): цвета oklch → hex-эквиваленты из `new-post.ts`, шрифты — Barlow Condensed (UI/кнопки/wordmark) + Cormorant Garamond (заголовки постов), editorial outline CTA без заливки. Wordmark «PROCONTENT» + подпись «Skupnost za ustvarjalce vsebin» в шапке — идентично `new-post.ts`. Без ссылки отписки — это личное уведомление, а не массовая рассылка подписчикам.

**Commenter name:** Клиент не передаёт имя в body — route считывает профиль `commenter_id` (= текущий пользователь по сессии) через admin-клиент, чтобы имя не могло быть подделано клиентом.

**Admin-клиент:** profiles.email закрыт RLS для чтения другими пользователями → нужен service_role. Паттерн взят из `sendNewPostNotification.ts`.

## Verification

**Commands:**
- `npm run typecheck` -- expected: 0 errors
- `npm run lint` -- expected: 0 errors

## Suggested Review Order

**Fire-and-forget trigger (entry point)**

- Единственное изменение существующего кода: запуск уведомления после успешной вставки комментария
  [`useComments.ts:148`](../../src/features/comments/hooks/useComments.ts#L148)

**Notification orchestration**

- Env-guard и запрос поста через admin-клиент (вне try/catch — ошибки конфигурации не замалчиваются)
  [`sendNewCommentNotification.ts:54`](../../src/lib/notifications/sendNewCommentNotification.ts#L54)

- Self-comment skip guard: `commenter_id === author_id` → `{ skipped: 'self' }`
  [`sendNewCommentNotification.ts:76`](../../src/lib/notifications/sendNewCommentNotification.ts#L76)

- Загрузка email автора через admin-клиент (RLS обойдён) + no-email guard
  [`sendNewCommentNotification.ts:84`](../../src/lib/notifications/sendNewCommentNotification.ts#L84)

- Формирование письма и `sendEmailBatch`
  [`sendNewCommentNotification.ts:100`](../../src/lib/notifications/sendNewCommentNotification.ts#L100)

**Route handler (auth + dispatch)**

- Авторизация через сессию (401 без user)
  [`route.ts:18`](../../src/app/api/notifications/new-comment/route.ts#L18)

- UUID-валидация `post_id` + чтение имени комментатора server-side
  [`route.ts:38`](../../src/app/api/notifications/new-comment/route.ts#L38)

- Warn при отсутствии профиля комментатора (patch из code review)
  [`route.ts:49`](../../src/app/api/notifications/new-comment/route.ts#L49)

**Email template (Warm Minimalism)**

- HTML шаблон: структура, Cormorant Garamond для заголовка поста, editorial outline CTA
  [`new-comment.ts:8`](../../src/lib/email/templates/new-comment.ts#L8)

- `escapeHtml` + `sanitizeHref` — защита от XSS и URL injection
  [`new-comment.ts:103`](../../src/lib/email/templates/new-comment.ts#L103)
