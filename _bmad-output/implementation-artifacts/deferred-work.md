# Deferred Work

## Deferred from: code review (2026-03-27) - 3-4-automatic-email-notifications-new-posts.md

### Раунды 1 и 2
- **Нет rate limiting / идемпотентности**: At-least-once доставка Supabase Webhook может привести к дубликатам писем при сбоях. [src/app/api/notifications/new-post/route.ts:39]
- **Безопасность Admin Auth**: Проверка роли полагается на колонку ole, которая при ошибках в RLS может быть уязвима. [src/app/api/notifications/new-post/route.ts:113]
- **Последовательные batch sends**: При большом количестве подписчиков риск превышения таймаута лямбды (10-15с). [src/lib/email/index.ts:48]
- **Unsubscribe link is not "one-click"**: Текущая ссылка ведет в профиль, а не выполняет мгновенную отписку по токену. Ожидается в Story 3.5. [src/app/api/notifications/new-post/route.ts:132]

## Deferred from: code review of 3-4-automatic-email-notifications-new-posts.md (2026-03-27) - Final Triage
- **Риск переполнения памяти (OOM)**: Функция fetchAllSubscribers собирает всех активных подписчиков в один массив. При росте базы это приведет к падению серверной функции. [src/app/api/notifications/new-post/route.ts:111]
- **Ограниченная конкурентность**: Последовательная отправка батчей по 100 писем рискует превысить таймаут Vercel при большом количестве подписчиков. [src/lib/email/index.ts:48]
- **Отсутствие Retry-логики**: Сбой одного батча из-за сети помечает его как failed навсегда без попыток переотправки. [src/lib/email/index.ts]

## Deferred from: code review of 3-4-automatic-email-notifications-new-posts.md (2026-03-27) - Round 7
- **_resend singleton не сбрасывается при ротации ключа**: Если RESEND_API_KEY меняется в runtime, устаревший клиент используется до следующего cold start — все письма будут падать с 401 от Resend без явного сигнала. [src/lib/email/index.ts:3]
- **etchAllSubscribers без верхнего предела**: Все подписчики накапливаются в один массив в памяти. При 50 000+ записях растёт задержка до первой отправки и расход памяти serverless-функции.  [src/app/api/notifications/new-post/route.ts:49]
- **sendEmailBatch без таймаута на чанк**: Зависание Resend API блокирует функцию до Vercel timeout (504); retry вебхука Supabase дублирует письма подписчикам из уже успешных чанков. [src/lib/email/index.ts:46]

## Deferred from: code review of 3-4-automatic-email-notifications-new-posts.md (2026-03-27) - Round 5
- **excerpt поле зависит от Story 4.1**: post.excerpt принимается route handler'ом и передаётся в шаблон, но таблица posts может не содержать этого поля до реализации Story 4.1. Пока excerpt приходит как undefined — шаблон отображает без excerpta. [src/app/api/notifications/new-post/route.ts:16]

## Deferred from: code review of 4-1-creating-and-editing-multimedia-posts.md (2026-03-29) - Round 4
- Отсутствие генерации миниатюр для видео (жесткий null) — deferred: требует бэкенд процессинга [src/features/admin/api/posts.ts]
- Хрупкая логика отката в createPost при сбое сети — deferred: архитектурное ограничение клиента (недоступность RPC транзакций) [src/features/admin/api/posts.ts]
- Определение MIME-типа по расширению — deferred: идеальное решение (магические числа) требует тяжелых библиотек [src/features/admin/components/MediaUploader.tsx]
- Тихие утечки при удалении старых медиа (best-effort очистка) — deferred: осознанный компромисс из Round 3 для избежания блокировки UI [src/features/admin/api/posts.ts]

## Deferred from: code review of 4-1-creating-and-editing-multimedia-posts.md (2026-03-29)
- Индекс порядка (order_index) может иметь пробелы [src/features/admin/api/posts.ts]
- Тихое проглатывание ошибок при откате [src/features/admin/api/posts.ts]
- Promise.allSettled скрывает индивидуальные ошибки [src/features/admin/api/uploadMedia.ts]
- Жестко закодированное имя бакета для хранилища [src/features/admin/api/uploadMedia.ts]
- Защитная проверка derivePostType скрывает неожиданные типы [src/features/admin/api/posts.ts]
- Отсутствуют заголовки кэширования файлов при загрузке [src/features/admin/api/uploadMedia.ts]
- Отсутствует атомарная транзакция для updatePost [src/features/admin/api/posts.ts]
- Удаление файла во время его загрузки (рассинхронизация) [src/features/admin/components/MediaUploader.tsx]
