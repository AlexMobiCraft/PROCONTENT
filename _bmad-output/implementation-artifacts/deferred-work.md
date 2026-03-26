## Deferred from: code review of 3-1-viewing-discussions-under-a-post.md (2026-03-25)

- Нет пагинации или лимитов при загрузке комментариев [src/features/comments/api/comments.ts] — deferred, pre-existing (will be needed when discussions grow large)
- Ошибки при загрузке комментариев в SSR скрываются без логирования [src/app/(app)/feed/[id]/page.tsx:68] — deferred, pre-existing (better error boundaries needed)

## Deferred from: code review of 3-4-automatic-email-notifications-new-posts.md (2026-03-26)

- Последовательная отправка батчей await resend.batch.send в цикле for может привести к превышению таймаута Vercel (10 секунд) при большом количестве подписчиков. [src/lib/email/index.ts:215] — deferred, pre-existing
- Отсутствие логирования конкретных email при ошибке батча. Логируется только ошибка, что затруднит повторную отправку. [src/lib/email/index.ts:225] — deferred, pre-existing
