
## Deferred from: code review of 3-1-viewing-discussions-under-a-post.md (2026-03-25)

- Нет пагинации или лимитов при загрузке комментариев [src/features/comments/api/comments.ts] — deferred, pre-existing (will be needed when discussions grow large)
- Ошибки при загрузке комментариев в SSR скрываются без логирования [src/app/(app)/feed/[id]/page.tsx:68] — deferred, pre-existing (better error boundaries needed)

