## Deferred from: code review of 3-1-viewing-discussions-under-a-post.md (2026-03-25)

- Нет пагинации или лимитов при загрузке комментариев [src/features/comments/api/comments.ts] — deferred, pre-existing (will be needed when discussions grow large)
- Ошибки при загрузке комментариев в SSR скрываются без логирования [src/app/(app)/feed/[id]/page.tsx:68] — deferred, pre-existing (better error boundaries needed)

## Deferred from: code review of 3-4-automatic-email-notifications-new-posts.md (2026-03-27)

- Нет rate limiting / идемпотентности — at-least-once Supabase webhook может разослать письма дважды по одному посту [src/app/api/notifications/new-post/route.ts:39]
- Admin auth полагается на user-writable колонку `role` — при некорректном RLS возможна privilege escalation [src/app/api/notifications/new-post/route.ts:113]
- Последовательные batch sends могут превысить таймаут Vercel при >100 подписчиках [src/lib/email/index.ts:48] — pre-existing
