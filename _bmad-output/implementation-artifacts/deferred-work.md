# Deferred Work

## Deferred from: code review (2026-03-27) - 3-4-automatic-email-notifications-new-posts.md

### Раунды 1 и 2
- **Нет rate limiting / идемпотентности**: At-least-once доставка Supabase Webhook может привести к дубликатам писем при сбоях. [src/app/api/notifications/new-post/route.ts:39]
- **Безопасность Admin Auth**: Проверка роли полагается на колонку `role`, которая при ошибках в RLS может быть уязвима. [src/app/api/notifications/new-post/route.ts:113]
- **Последовательные batch sends**: При большом количестве подписчиков риск превышения таймаута лямбды (10-15с). [src/lib/email/index.ts:48]
- **Unsubscribe link is not "one-click"**: Текущая ссылка ведет в профиль, а не выполняет мгновенную отписку по токену. Ожидается в Story 3.5. [src/app/api/notifications/new-post/route.ts:132]

## Deferred from: code review of 3-4-automatic-email-notifications-new-posts.md (2026-03-27) - Final Triage
- **Риск переполнения памяти (OOM)**: Функция fetchAllSubscribers собирает всех активных подписчиков в один массив. При росте базы это приведет к падению серверной функции. [src/app/api/notifications/new-post/route.ts:111]
- **Ограниченная конкурентность**: Последовательная отправка батчей по 100 писем рискует превысить таймаут Vercel при большом количестве подписчиков. [src/lib/email/index.ts:48]
- **Отсутствие Retry-логики**: Сбой одного батча из-за сети помечает его как failed навсегда без попыток переотправки. [src/lib/email/index.ts]
