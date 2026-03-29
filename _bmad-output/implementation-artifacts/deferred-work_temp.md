# Deferred Work

## Deferred from: code review (2026-03-27) - 3-4-automatic-email-notifications-new-posts.md

### Đ Đ°ŃĐ˝Đ´Ń‹ 1 Đ¸ 2
- **ĐťĐµŃ‚ rate limiting / Đ¸Đ´ĐµĐĽĐżĐľŃ‚ĐµĐ˝Ń‚Đ˝ĐľŃŃ‚Đ¸**: At-least-once Đ´ĐľŃŃ‚Đ°Đ˛ĐşĐ° Supabase Webhook ĐĽĐľĐ¶ĐµŃ‚ ĐżŃ€Đ¸Đ˛ĐµŃŃ‚Đ¸ Đş Đ´ŃĐ±Đ»Đ¸ĐşĐ°Ń‚Đ°ĐĽ ĐżĐ¸ŃĐµĐĽ ĐżŃ€Đ¸ ŃĐ±ĐľŃŹŃ…. [src/app/api/notifications/new-post/route.ts:39]
- **Đ‘ĐµĐ·ĐľĐżĐ°ŃĐ˝ĐľŃŃ‚ŃŚ Admin Auth**: ĐźŃ€ĐľĐ˛ĐµŃ€ĐşĐ° Ń€ĐľĐ»Đ¸ ĐżĐľĐ»Đ°ĐłĐ°ĐµŃ‚ŃŃŹ Đ˝Đ° ĐşĐľĐ»ĐľĐ˝ĐşŃ `role`, ĐşĐľŃ‚ĐľŃ€Đ°ŃŹ ĐżŃ€Đ¸ ĐľŃĐ¸Đ±ĐşĐ°Ń… Đ˛ RLS ĐĽĐľĐ¶ĐµŃ‚ Đ±Ń‹Ń‚ŃŚ ŃŃŹĐ·Đ˛Đ¸ĐĽĐ°. [src/app/api/notifications/new-post/route.ts:113]
- **ĐźĐľŃĐ»ĐµĐ´ĐľĐ˛Đ°Ń‚ĐµĐ»ŃŚĐ˝Ń‹Đµ batch sends**: ĐźŃ€Đ¸ Đ±ĐľĐ»ŃŚŃĐľĐĽ ĐşĐľĐ»Đ¸Ń‡ĐµŃŃ‚Đ˛Đµ ĐżĐľĐ´ĐżĐ¸ŃŃ‡Đ¸ĐşĐľĐ˛ Ń€Đ¸ŃĐş ĐżŃ€ĐµĐ˛Ń‹ŃĐµĐ˝Đ¸ŃŹ Ń‚Đ°ĐąĐĽĐ°ŃŃ‚Đ° Đ»ŃŹĐĽĐ±Đ´Ń‹ (10-15Ń). [src/lib/email/index.ts:48]
- **Unsubscribe link is not "one-click"**: Đ˘ĐµĐşŃŃ‰Đ°ŃŹ ŃŃŃ‹Đ»ĐşĐ° Đ˛ĐµĐ´ĐµŃ‚ Đ˛ ĐżŃ€ĐľŃ„Đ¸Đ»ŃŚ, Đ° Đ˝Đµ Đ˛Ń‹ĐżĐľĐ»Đ˝ŃŹĐµŃ‚ ĐĽĐłĐ˝ĐľĐ˛ĐµĐ˝Đ˝ŃŃŽ ĐľŃ‚ĐżĐ¸ŃĐşŃ ĐżĐľ Ń‚ĐľĐşĐµĐ˝Ń. ĐžĐ¶Đ¸Đ´Đ°ĐµŃ‚ŃŃŹ Đ˛ Story 3.5. [src/app/api/notifications/new-post/route.ts:132]

## Deferred from: code review of 3-4-automatic-email-notifications-new-posts.md (2026-03-27) - Final Triage
- **Đ Đ¸ŃĐş ĐżĐµŃ€ĐµĐżĐľĐ»Đ˝ĐµĐ˝Đ¸ŃŹ ĐżĐ°ĐĽŃŹŃ‚Đ¸ (OOM)**: Đ¤ŃĐ˝ĐşŃ†Đ¸ŃŹ fetchAllSubscribers ŃĐľĐ±Đ¸Ń€Đ°ĐµŃ‚ Đ˛ŃĐµŃ… Đ°ĐşŃ‚Đ¸Đ˛Đ˝Ń‹Ń… ĐżĐľĐ´ĐżĐ¸ŃŃ‡Đ¸ĐşĐľĐ˛ Đ˛ ĐľĐ´Đ¸Đ˝ ĐĽĐ°ŃŃĐ¸Đ˛. ĐźŃ€Đ¸ Ń€ĐľŃŃ‚Đµ Đ±Đ°Đ·Ń‹ ŃŤŃ‚Đľ ĐżŃ€Đ¸Đ˛ĐµĐ´ĐµŃ‚ Đş ĐżĐ°Đ´ĐµĐ˝Đ¸ŃŽ ŃĐµŃ€Đ˛ĐµŃ€Đ˝ĐľĐą Ń„ŃĐ˝ĐşŃ†Đ¸Đ¸. [src/app/api/notifications/new-post/route.ts:111]
- **ĐžĐłŃ€Đ°Đ˝Đ¸Ń‡ĐµĐ˝Đ˝Đ°ŃŹ ĐşĐľĐ˝ĐşŃŃ€ĐµĐ˝Ń‚Đ˝ĐľŃŃ‚ŃŚ**: ĐźĐľŃĐ»ĐµĐ´ĐľĐ˛Đ°Ń‚ĐµĐ»ŃŚĐ˝Đ°ŃŹ ĐľŃ‚ĐżŃ€Đ°Đ˛ĐşĐ° Đ±Đ°Ń‚Ń‡ĐµĐą ĐżĐľ 100 ĐżĐ¸ŃĐµĐĽ Ń€Đ¸ŃĐşŃĐµŃ‚ ĐżŃ€ĐµĐ˛Ń‹ŃĐ¸Ń‚ŃŚ Ń‚Đ°ĐąĐĽĐ°ŃŃ‚ Vercel ĐżŃ€Đ¸ Đ±ĐľĐ»ŃŚŃĐľĐĽ ĐşĐľĐ»Đ¸Ń‡ĐµŃŃ‚Đ˛Đµ ĐżĐľĐ´ĐżĐ¸ŃŃ‡Đ¸ĐşĐľĐ˛. [src/lib/email/index.ts:48]
- **ĐžŃ‚ŃŃŃ‚ŃŃ‚Đ˛Đ¸Đµ Retry-Đ»ĐľĐłĐ¸ĐşĐ¸**: ĐˇĐ±ĐľĐą ĐľĐ´Đ˝ĐľĐłĐľ Đ±Đ°Ń‚Ń‡Đ° Đ¸Đ·-Đ·Đ° ŃĐµŃ‚Đ¸ ĐżĐľĐĽĐµŃ‡Đ°ĐµŃ‚ ĐµĐłĐľ ĐşĐ°Đş failed Đ˝Đ°Đ˛ŃĐµĐłĐ´Đ° Đ±ĐµĐ· ĐżĐľĐżŃ‹Ń‚ĐľĐş ĐżĐµŃ€ĐµĐľŃ‚ĐżŃ€Đ°Đ˛ĐşĐ¸. [src/lib/email/index.ts]

## Deferred from: code review of 3-4-automatic-email-notifications-new-posts.md (2026-03-27) - Round 7
- **`_resend` singleton Đ˝Đµ ŃĐ±Ń€Đ°ŃŃ‹Đ˛Đ°ĐµŃ‚ŃŃŹ ĐżŃ€Đ¸ Ń€ĐľŃ‚Đ°Ń†Đ¸Đ¸ ĐşĐ»ŃŽŃ‡Đ°**: Đ•ŃĐ»Đ¸ `RESEND_API_KEY` ĐĽĐµĐ˝ŃŹĐµŃ‚ŃŃŹ Đ˛ runtime, ŃŃŃ‚Đ°Ń€ĐµĐ˛ŃĐ¸Đą ĐşĐ»Đ¸ĐµĐ˝Ń‚ Đ¸ŃĐżĐľĐ»ŃŚĐ·ŃĐµŃ‚ŃŃŹ Đ´Đľ ŃĐ»ĐµĐ´ŃŃŽŃ‰ĐµĐłĐľ cold start â€” Đ˛ŃĐµ ĐżĐ¸ŃŃŚĐĽĐ° Đ±ŃĐ´ŃŃ‚ ĐżĐ°Đ´Đ°Ń‚ŃŚ Ń 401 ĐľŃ‚ Resend Đ±ĐµĐ· ŃŹĐ˛Đ˝ĐľĐłĐľ ŃĐ¸ĐłĐ˝Đ°Đ»Đ°. [src/lib/email/index.ts:3]
- **`fetchAllSubscribers` Đ±ĐµĐ· Đ˛ĐµŃ€Ń…Đ˝ĐµĐłĐľ ĐżŃ€ĐµĐ´ĐµĐ»Đ°**: Đ’ŃĐµ ĐżĐľĐ´ĐżĐ¸ŃŃ‡Đ¸ĐşĐ¸ Đ˝Đ°ĐşĐ°ĐżĐ»Đ¸Đ˛Đ°ŃŽŃ‚ŃŃŹ Đ˛ ĐľĐ´Đ¸Đ˝ ĐĽĐ°ŃŃĐ¸Đ˛ Đ˛ ĐżĐ°ĐĽŃŹŃ‚Đ¸. ĐźŃ€Đ¸ 50 000+ Đ·Đ°ĐżĐ¸ŃŃŹŃ… Ń€Đ°ŃŃ‚Ń‘Ń‚ Đ·Đ°Đ´ĐµŃ€Đ¶ĐşĐ° Đ´Đľ ĐżĐµŃ€Đ˛ĐľĐą ĐľŃ‚ĐżŃ€Đ°Đ˛ĐşĐ¸ Đ¸ Ń€Đ°ŃŃ…ĐľĐ´ ĐżĐ°ĐĽŃŹŃ‚Đ¸ serverless-Ń„ŃĐ˝ĐşŃ†Đ¸Đ¸.  [src/app/api/notifications/new-post/route.ts:49]
- **`sendEmailBatch` Đ±ĐµĐ· Ń‚Đ°ĐąĐĽĐ°ŃŃ‚Đ° Đ˝Đ° Ń‡Đ°Đ˝Đş**: Đ—Đ°Đ˛Đ¸ŃĐ°Đ˝Đ¸Đµ Resend API Đ±Đ»ĐľĐşĐ¸Ń€ŃĐµŃ‚ Ń„ŃĐ˝ĐşŃ†Đ¸ŃŽ Đ´Đľ Vercel timeout (504); retry Đ˛ĐµĐ±Ń…ŃĐşĐ° Supabase Đ´ŃĐ±Đ»Đ¸Ń€ŃĐµŃ‚ ĐżĐ¸ŃŃŚĐĽĐ° ĐżĐľĐ´ĐżĐ¸ŃŃ‡Đ¸ĐşĐ°ĐĽ Đ¸Đ· ŃĐ¶Đµ ŃŃĐżĐµŃĐ˝Ń‹Ń… Ń‡Đ°Đ˝ĐşĐľĐ˛. [src/lib/email/index.ts:46]

## Deferred from: code review of 3-4-automatic-email-notifications-new-posts.md (2026-03-27) - Round 5
- **`excerpt` ĐżĐľĐ»Đµ Đ·Đ°Đ˛Đ¸ŃĐ¸Ń‚ ĐľŃ‚ Story 4.1**: `post.excerpt` ĐżŃ€Đ¸Đ˝Đ¸ĐĽĐ°ĐµŃ‚ŃŃŹ route handler'ĐľĐĽ Đ¸ ĐżĐµŃ€ĐµĐ´Đ°Ń‘Ń‚ŃŃŹ Đ˛ ŃĐ°Đ±Đ»ĐľĐ˝, Đ˝Đľ Ń‚Đ°Đ±Đ»Đ¸Ń†Đ° `posts` ĐĽĐľĐ¶ĐµŃ‚ Đ˝Đµ ŃĐľĐ´ĐµŃ€Đ¶Đ°Ń‚ŃŚ ŃŤŃ‚ĐľĐłĐľ ĐżĐľĐ»ŃŹ Đ´Đľ Ń€ĐµĐ°Đ»Đ¸Đ·Đ°Ń†Đ¸Đ¸ Story 4.1. ĐźĐľĐşĐ° excerpt ĐżŃ€Đ¸Ń…ĐľĐ´Đ¸Ń‚ ĐşĐ°Đş `undefined` â€” ŃĐ°Đ±Đ»ĐľĐ˝ ĐľŃ‚ĐľĐ±Ń€Đ°Đ¶Đ°ĐµŃ‚ Đ±ĐµĐ· excerpta. [src/app/api/notifications/new-post/route.ts:16]

## Deferred from: code review of 4-1-creating-and-editing-multimedia-posts.md (2026-03-29)
- Индекс порядка (order_index) может иметь пробелы [src/features/admin/api/posts.ts]
- Тихое проглатывание ошибок при откате [src/features/admin/api/posts.ts]
- Promise.allSettled скрывает индивидуальные ошибки [src/features/admin/api/uploadMedia.ts]
- Жестко закодированное имя бакета для хранилища [src/features/admin/api/uploadMedia.ts]
- Защитная проверка derivePostType скрывает неожиданные типы [src/features/admin/api/posts.ts]
- Отсутствуют заголовки кэширования файлов при загрузке [src/features/admin/api/uploadMedia.ts]
- Отсутствует атомарная транзакция для updatePost [src/features/admin/api/posts.ts]
- Удаление файла во время его загрузки (рассинхронизация) [src/features/admin/components/MediaUploader.tsx]

