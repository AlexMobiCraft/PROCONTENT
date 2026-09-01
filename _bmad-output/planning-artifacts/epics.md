---
stepsCompleted: ["step-01-validate-prerequisites", "step-02-design-epics", "step-03-create-stories", "step-04-final-validation", "epic6-step-01-validate-prerequisites", "epic6-step-02-design-epics", "epic6-step-03-create-stories", "epic6-step-04-final-validation", "epic8-step-01-validate-prerequisites", "epic8-step-02-design-epics", "epic8-step-03-create-stories", "epic9-step-01-validate-prerequisites", "epic9-step-02-design-epics", "epic9-step-03-create-stories", "epic9-step-04-final-validation"]
inputDocuments: ["_bmad-output/planning-artifacts/prd.md", "_bmad-output/planning-artifacts/architecture.md", "_bmad-output/planning-artifacts/ux-design-specification.md", "_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-01.md"]
lastEdited: '2026-09-01'
editHistory:
  - date: '2026-09-01'
    changes: 'Извлечены требования временного one-time предложения из согласованного набора PRD, Architecture, UX и Sprint Change Proposal; общий FR/NFR inventory синхронизирован с актуальным PRD без изменения завершённых Epics 1–8.'
  - date: '2026-09-01'
    changes: 'Одобрена структура Epic 9 как одного самостоятельного user-value epic; добавлены Epic List entry и FR coverage для временной коммерческой ветви.'
  - date: '2026-09-01'
    changes: 'По результатам Party Mode Epic 9 разделён на три последовательные истории: 9.1 entitlement/access foundation, 9.2 one-time purchase/activation, 9.3 rollback/exceptions; истории утверждены и добавлены с полными Acceptance Criteria.'
  - date: '2026-09-01'
    changes: 'После scoped final validation уточнены AC Epic 9: payment provenance FK без forward dependency, resolver valid_until semantics, Stripe paid_at source, post-payment/network UX и email SLA/deliverability.'
  - date: '2026-09-01'
    changes: 'Scoped final validation Epic 9 пройдена: все change FR/NFR/architecture/UX requirements покрыты, story dependencies направлены 9.1 → 9.2 → 9.3, placeholders и formatting errors отсутствуют.'
  - date: '2026-03-22'
    changes: 'Обновлены эпики и стори на основании обновлённых PRD, Architecture и двух брифов (architect-brief-multimedia-posts, sm-brief-multimedia-posts): добавлена нормализация БД (post_media), RBAC/RLS, GalleryGrid, видеоконтроллер, NFR SLAs, обновлена Telegram-миграция (Exponential Backoff, медиагруппы как галереи), обновлены Acceptance Criteria'
  - date: '2026-04-01'
    changes: 'Epic 6 (Scheduled Publishing): добавлены FR6.1–FR6.18 (18 FRs), NFR6.1–NFR6.9 (9 NFRs), дополнительные технические требования (pg_cron, схема БД, cron endpoint) и UX-DR1–UX-DR9. Step-01 validate prerequisites завершён.'
  - date: '2026-04-05'
    changes: 'Добавлен Epic 7 (Rich Content Experience): Story 7.1 (FR19.1: WYSIWYG-редактор с инлайн-изображениями, Tiptap + inline-images bucket) и Story 7.2 (FR16.2, NFR4.2: HTML-рендеринг rich-content, комбинированный layout, DOMPurify). Обновлены FR Coverage Map и Epic List.'
  - date: '2026-05-17'
    changes: 'Добавлен Epic 8 (Video Thumbnails): FR8.1–FR8.7 (7 FRs), NFR8.1–NFR8.6 (6 NFRs), UX-DR8.1–UX-DR8.4, Stories 8.1–8.4. Обновлены FR Coverage Map и Epic List. Создан отдельный PRD: prd-video-thumbnails.md'
---

# PROCONTENT - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for PROCONTENT, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: [M] Постоянная коммерческая модель позволяет посетительнице оформить через Stripe recurring-подписку: ежемесячно 12,99€ или на 3 месяца 34€
FR1.1: [M] При первичной регистрации участница получает ссылку на введённый email; перейдя по ней, верифицирует почту и придумывает пароль
FR1.2: [M] Участница может входить на платформу, используя введённые ранее email и пароль
FR1.3: [M] Участница может запросить ссылку для сброса и изменения пароля на свой подтверждённый email
FR1.4: [M] В период `[2026-09-01 00:00, 2026-12-01 00:00) Europe/Ljubljana` для новых покупок система предлагает только разовый Stripe-платёж 29€ за доступ к существующей базе на 3 календарных месяца; действующие recurring-подписки остаются без изменений
FR1.4.1: [M] Временное предложение не содержит выбора тарифов, recurring-платежей, автопродления, помесячного расчёта, отмены подписки или обещания регулярной публикации нового контента
FR1.4.2: [M] Право временного разового доступа создаётся только после подтверждённой оплаты и верификации того же нормализованного email; оно действует от `paid_at` до `paid_at + interval '3 months'`
FR1.4.3: [M] Участница с действующей recurring-подпиской (`active` или `trialing`) не видит и не может оформить временное предложение; бывшая участница без действующей recurring-подписки допускается на общих условиях
FR2: [M] В рамках постоянной recurring-модели участница может отменить подписку в любое время через личный кабинет
FR3: [M] Система автоматически закрывает доступ к закрытому контенту при неоплате или отмене recurring-подписки
FR3.1: [M] Система автоматически закрывает временный разовый доступ при достижении `access_ends_at`; окончание публичного предложения не сокращает ранее выданный индивидуальный срок
FR4: [M] Участница может просмотреть статус своей подписки (активна / истекает / отменена)
FR5: [M] В постоянной recurring-модели система восстанавливает доступ автоматически при успешной повторной оплате
FR5.1: [M] С `2026-12-01 00:00 Europe/Ljubljana` система прекращает направлять новые покупки к временному предложению, возвращает исходный recurring UI/checkout и деактивирует временный Payment Link; уже выданные entitlements действуют до `access_ends_at`, а действующие subscriptions не изменяются
FR6: [M] Незарегистрированная посетительница может просмотреть превью-посты на лендинге без регистрации
FR7: [M] Незарегистрированная посетительница может прочитать отзывы участниц сообщества на лендинге
FR8: [M] Незарегистрированная посетительница может перейти с лендинга к оплате, соответствующей действующей коммерческой модели
FR9: [S] Автор может выбрать, какие посты отображаются как превью на лендинге
FR10: [M] Новая участница после первой оплаты попадает на специальную onboarding-страницу
FR11: [M] Участница видит на onboarding-странице подборку «Начни здесь» (топ-5 рекомендованных постов)
FR12: [M] Участница может перейти в WhatsApp-группу сообщества по ссылке с onboarding-страницы
FR13: [S] Автор может управлять содержимым onboarding-страницы (топ-5 постов, WhatsApp-ссылка)
FR14: [M] Участница может просматривать ленту всех опубликованных постов в хронологическом порядке
FR15: [M] Участница может фильтровать ленту по рубрикам/категориям контента
FR16: [M] Участница может открыть отдельный пост любого формата (текст, одиночное медиа, галерея)
FR16.1: [M] Система отображает галереи в зависимости от количества медиа: 2–4 элемента — сетка, 5 — сетка 2х3, 6 — сетка 3х3, 7+ — сетка 2х2 с каруселью ниже
FR16.2: [M] Контент поста поддерживает rich-text article body как sanitized HTML из WYSIWYG-редактора со встроенными инлайн-изображениями; при наличии галереи она располагается над article body без смешивания доменов
FR17: [S] Участница может искать контент по ключевым словам во всём архиве
FR18: [S] Участница может просмотреть весь контент архива Telegram в хронологическом порядке
FR19: [M] Автор может создавать и публиковать посты с галереями до 10 медиа вне article body и rich-text article body без жёстких лимитов на инлайн-изображения, сохраняя gallery media и inline media независимыми доменами
FR19.1: [M] Платформа предоставляет встроенный легковесный WYSIWYG-редактор для HTML article body, прямой загрузки инлайн-изображений в secure media storage и автоматической вставки ссылок в тело поста
FR20: [M] Автор может назначать рубрику/категорию каждому посту при публикации
FR21: [M] Автор может редактировать и удалять опубликованные посты
FR22: [S] Автор может назначать посты в подборку onboarding («Начни здесь»)
FR23: [M] Участница может оставить комментарий под любым постом
FR24: [M] Участница может видеть все комментарии под постом
FR25: [M] Автор может ответить на комментарий участницы
FR26: [M] Автор может удалить комментарий
FR27: [M] Участница автоматически получает email-уведомление о новом опубликованном посте; участница с действующим временным entitlement включается в число получателей наравне с recurring-подписчицами
FR28: [M] Участница может управлять своими email-предпочтениями (отписаться от уведомлений)
FR29: [M] Администратор может запустить импорт архива Telegram-контента через отдельный инструмент
FR30: [M] Система сохраняет оригинальные даты публикаций при импорте из Telegram
FR31: [M] Система без потерь импортирует все медиаформаты из Telegram (текст, фото, видео, медиагруппы сохраняются как единые галереи с оригинальным текстом)
FR32: [M] Автор может просматривать список всех активных участниц и статус их Stripe-подписок
FR33: [M] Автор может вручную предоставить или отозвать доступ для конкретной участницы
FR34: [M] Автор может управлять рубриками и категориями контента
FR35: [M] Автор может обновить WhatsApp-ссылку в onboarding-странице и интерфейсе платформы
FR36: [M] Автор может выбрать режим публикации при создании поста — «Опубликовать сейчас» или «Запланировать»
FR37: [M] Автор может указать дату и время плановой публикации в режиме «Запланировать» с валидацией будущего времени
FR38: [M] Система сохраняет пост в статусе `scheduled`, и он не отображается в ленте до времени публикации
FR39: [M] Система автоматически публикует запланированные посты и отправляет email-уведомления без участия автора
FR40: [S] Автор может просматривать очередь всех запланированных постов
FR41: [S] Автор может изменить содержимое или время публикации запланированного поста до его выхода
FR42: [S] Автор может отменить запланированную публикацию, вернув пост в `draft`, или опубликовать её немедленно

### NonFunctional Requirements

NFR1: Лендинг — Largest Contentful Paint (LCP) ≤ 2.5 сек на мобайле (3G сеть)
NFR2: Time to Interactive (TTI) для всех публичных страниц ≤ 4 секунды
NFR3: Страницы с видеоконтентом сохраняют Time to Interactive ≤ 4 сек на мобайле (3G сеть) — видео не блокирует интерактивность страницы
NFR4: Изображения загружаются за ≤ 1 сек на мобайле (3G сеть) при любом разрешении экрана
NFR4.1: В галерее одновременно активно воспроизводится только одно видео (для производительности и фокусировки внимания)
NFR4.2: Все инлайн-изображения в HTML article body используют lazy loading для предотвращения блокировки интерактивности страницы
NFR5: Платформа поддерживает одновременную сессию до 50 активных пользователей с 95th percentile response time ≤ 500ms для API-запросов (целевой масштаб v1)
NFR6: Все HTTP-соединения защищены TLS (HTTPS обязателен для всех страниц и API)
NFR7: Аутентификационные сессии имеют ограниченный срок действия (≤ 30 дней) и инвалидируются в течение 60 секунд после отмены или неоплаты подписки
NFR8: Stripe webhook-запросы проверяются по цифровой подписи (webhook signature verification) перед обработкой
NFR9: Управление банковскими картами полностью делегировано Stripe (платформа не хранит и не обрабатывает карточные данные)
NFR10: Платформа предоставляет страницу Политики конфиденциальности до сбора любых персональных данных
NFR11: Лендинг отображает cookie consent banner для незарегистрированных посетительниц
NFR12: Участница может запросить полное удаление своего аккаунта и персональных данных
NFR13: Данные удалённой или отписавшейся участницы хранятся не более 3 месяцев, затем удаляются
NFR14: Все пользовательские интерфейсы соответствуют WCAG 2.1 Level AA
NFR15: Цветовой контраст текста относительно фона — не менее 4.5:1
NFR16: Все изображения и медиа содержат корректные alt-атрибуты
NFR17: Полная keyboard navigation поддерживается на десктопных браузерах
NFR18: Обработка Stripe webhook-событий идемпотентна (повторная доставка одного события не создаёт дублирующих изменений доступа)
NFR19: При сбое обработки webhook система логирует событие для ручной проверки администратором
NFR19.1: В случае таймаута или ошибки при инициализации платежа Stripe, система показывает дружелюбное сообщение с рекомендацией повторить попытку позже
NFR19.2: Если Telegram API возвращает ошибку (Rate Limit / Timeout) во время миграции, скрипт сохраняет стейт и приостанавливает работу с возможностью автоматического возобновления (Exponential Backoff) без дублирования
NFR20: Уведомления о новых публикациях доставляются в течение 5 минут после публикации поста
NFR21: Email-уведомления о публикациях доставляются с delivery rate ≥ 95% и не попадают в спам-фильтры получательниц (deliverability мониторинг обязателен)
NFR22: База данных резервируется автоматически не реже 1 раза в сутки
NFR23: Медиафайлы (видео, фото) доступны с uptime ≥ 99.5% и загружаются со скоростью ≥ 1 Мб/с для пользователей в Словении
NFR24: Telegram-архив после импорта является иммутабельной исторической записью и не перезаписывается повторными запусками скрипта
NFR25: Запланированный пост публикуется в течение 10 минут от назначенного времени (`scheduled_at`)
NFR26: Система гарантирует публикацию каждого поста ровно один раз через идемпотентность `published_at`
NFR27: При временном сбое все пропущенные публикации выполняются автоматически после восстановления планировщика

### Additional Requirements

- **Starter Template:** Next.js (App Router) + TypeScript (`npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`)
- Инфраструктура: Vercel (нулевая конфигурация, авто CI/CD из GitHub, встроенная оптимизация Next/Image).
- Данные и Аутентификация: PostgreSQL + Supabase Auth (Latest 2.x), интеграция со Stripe Webhooks.
- Хранение медиа: Supabase Storage для видео/фото, выдача через Next/Image CDN на Vercel.
- Управление состоянием: Zustand v5.x (для глобального UI стейта, как MobileNav, Modals, Sheets).
- Структура проекта: Feature-based архитектура (`src/features/*`), базовые элементы в `src/components/ui/`.
- Именование БД-типов: `snake_case` (ESLint-правило для `camelcase` отключается).
- Паттерн компонентов: Strict Smart Container / Dumb UI, где Skeletons встроены в Dumb-компоненты.
- Обработка ошибок: Toasts для системных ошибок (загрузка данных, мутации), inline-сообщения для ошибок форм.
- Дизайн-система: Tailwind CSS + Headless UI (shadcn/ui), Mobile-First подход (брейкпоинты 375px/390px).
- Навигация: Bottom Navigation Bar на мобильных, Sidebar на десктопе; отказ от бургер-меню на мобильных.
- Паттерны загрузки: Skeleton Loading для бесшовных переходов (SPA-эффект).
- Комментарии: Плоский список с визуальным отступом (1 уровень вложенности).
- Оптимизация медиа: `LazyMediaWrapper` для отложенной загрузки тяжелого контента.
- Sticky элементы: Панель фильтров рубрик закрепляется при скролле.
- Доступность: Минимальный размер области нажатия 44x44px.
- **Нормализованная схема медиа:** Таблица `post_media` связана с `posts` (FK, CASCADE ON DELETE). Поля: `id`, `post_id`, `media_type` (image/video), `url`, `thumbnail_url`, `order_index`, `is_cover`.
- **RBAC матрица:** Guest (лендинг/превью), Subscriber (лента/галереи/комментарии/поиск), Admin (создание/редактирование контента, управление участницами).
- **Контроль видео:** Одновременно активно воспроизводится не более 1 видео в ленте (через глобальный видеоконтроллер в Zustand store).
- **SEO для галерей:** Open Graph `og:image` генерируется на основе первого медиа (или явно заданной обложки `is_cover`).

### FR Coverage Map

- FR1–FR5: Epic 1 - Stripe-подписки и доступ
- FR1.4, FR1.4.1, FR1.4.2, FR1.4.3, FR3.1, FR5.1: Epic 9 - временная one-time покупка, entitlement, expiry и rollback без изменения recurring lifecycle
- FR6–FR9: Epic 1 - Лендинг и превью
- FR8 (temporary branch): Epic 9 - server-derived переход к действующей временной коммерческой модели
- FR10–FR13: Epic 1 - Онбординг и WhatsApp
- FR14–FR16, FR16.1: Epic 2 - Лента, фильтры, просмотр контента и мультимедиа-галереи
- FR16.2: Epic 7 / Story 7.2 - HTML-рендеринг rich-content с инлайн-изображениями и комбинированный layout
- FR17–FR18: Epic 2 - Поиск и архив
- FR19–FR22: Epic 4 - Создание мультимедийных постов и управление контентом
- FR19.1: Epic 7 / Story 7.1 - WYSIWYG-редактор для инлайн-изображений
- FR23–FR26: Epic 3 - Комментарии
- FR27–FR28: Epic 3 - Email-уведомления
- FR27 (temporary branch): Epic 9 - включение активных temporary entitlements в recipient selection
- FR29–FR31: Epic 5 - Миграция из Telegram (включая интеллектуальную группировку медиагрупп)
- FR32–FR35: Epic 4 - Управление участницами, категориями и настройками
- FR6.1–FR6.18: Epic 6 - Scheduled Publishing (отложенная публикация)
- FR8.1–FR8.7: Epic 8 - Video Thumbnails (автоматические и ручные постеры для видео)

---

## Epic 6 Requirements Inventory (Scheduled Publishing)

### Functional Requirements — Epic 6

FR6.1: Автор может выбрать режим публикации при создании поста — «Опубликовать сейчас» или «Запланировать»
FR6.2: Автор может указать дату и время плановой публикации в режиме «Запланировать»
FR6.3: Система отображает автору подтверждение планируемого времени публикации с указанием timezone (CET/CEST)
FR6.4: Система валидирует, что указанное время публикации находится в будущем
FR6.5: Автор может сохранить пост в статусе `scheduled` — пост не появляется в ленте участников
FR6.6: Автор может изменить содержимое запланированного поста до момента публикации
FR6.7: Автор может изменить запланированное время (`scheduled_at`) до момента публикации
FR6.8: Автор может отменить запланированную публикацию — пост возвращается в статус `draft`
FR6.9: Автор может опубликовать запланированный пост немедленно, не дожидаясь назначенного времени
FR6.10: Система автоматически публикует посты со статусом `scheduled`, у которых наступило `scheduled_at`
FR6.11: Система публикует все пропущенные из-за downtime посты при следующем запуске планировщика
FR6.12: Система гарантирует публикацию каждого поста ровно один раз — повторные запуски не создают дублей (идемпотентность)
FR6.13: Система гарантирует отсутствие race condition при параллельных запусках планировщика
FR6.14: Автор может просматривать список всех запланированных постов с датами и статусами
FR6.15: Автор может перейти к редактированию любого запланированного поста из списка
FR6.16: Автор может отменить публикацию поста непосредственно из списка
FR6.17: Участники получают стандартное email-уведомление в момент автоматической публикации запланированного поста
FR6.18: Система не отправляет повторное email-уведомление при ретрае уже опубликованного поста

### Non-Functional Requirements — Epic 6

NFR6.1: Запланированный пост публикуется в течение **10 минут** от `scheduled_at` (pg_cron интервал 5 минут + overhead)
NFR6.2: Email-уведомление доставляется участникам в течение **5 минут** после фактической публикации
NFR6.3: Cron-функция выполняется за **≤ 30 секунд** при одновременной публикации нескольких постов
NFR6.4: Прямой вызов cron endpoint без авторизации возвращает `401`
NFR6.5: Поля `status=scheduled` и `scheduled_at` изменяемы только ролью `admin` — RLS Supabase запрещает изменение участникам
NFR6.6: `published_at` устанавливается только системой (pg_cron) — клиентский API не может изменить это поле
NFR6.7: Повторный запуск планировщика не изменяет статус поста с `published_at IS NOT NULL` — идемпотентность гарантирована
NFR6.8: При downtime до **24 часов** все пропущенные публикации выполняются автоматически при восстановлении без вмешательства администратора
NFR6.9: Ошибка публикации одного поста (например, сбой email-провайдера) не блокирует публикацию остальных постов в той же итерации

### Additional Requirements — Epic 6

- **Схема БД:** Расширение таблицы `posts` — добавить поля `status TEXT DEFAULT 'draft'`, `scheduled_at TIMESTAMPTZ`, `published_at TIMESTAMPTZ` + частичный индекс `idx_posts_scheduled WHERE status = 'scheduled'`
- **pg_cron:** Задача каждые 5 минут через Supabase PostgreSQL extension (`cron.schedule('*/5 * * * *', ...)`)
- **Cron endpoint:** Новый Route Handler `src/app/api/cron/publish/route.ts` — защищён `CRON_SECRET` в заголовке Authorization
- **Атомарность:** `UPDATE posts SET status='published', published_at=now() WHERE status='scheduled' AND scheduled_at <= now() AND published_at IS NULL RETURNING id` — гарантирует идемпотентность и race-condition safety
- **Timezone:** `scheduled_at` хранится в UTC, отображается через `Intl.DateTimeFormat` в браузерной timezone (CET/CEST переход обрабатывается браузером)
- **Интеграция форм:** Toggle + conditionally rendered datetime picker встраиваются в существующую форму создания/редактирования поста (расширение Story 4.1)
- **Email:** Существующий механизм Resend не требует переработки — меняется только триггер (с INSERT на UPDATE по статусу `published`)
- **Модуль:** `src/features/admin/` расширяется компонентами scheduled publishing; новые UI-компоненты в `src/features/admin/components/`
- **snake_case:** Все новые поля БД (`scheduled_at`, `published_at`, `status`) используются напрямую без маппинга в camelCase

### UX Design Requirements — Epic 6

UX-DR1: Touch targets `min-h-[44px] min-w-[44px]` для toggle «Запланировать» и всех интерактивных элементов datetime picker
UX-DR2: ARIA-атрибуты — `aria-pressed` на toggle, `aria-label` на datetime input, `aria-describedby` связывает поле с timezone-preview текстом
UX-DR3: Полная keyboard navigation для toggle и datetime picker (WCAG 2.1 Level AA)
UX-DR4: Inline error message под datetime picker при невалидном значении (время в прошлом или пустое при режиме «Запланировать»)
UX-DR5: Toast для системных ошибок (сбой сохранения scheduled поста, ошибка отмены из таблицы)
UX-DR6: Skeleton loading для таблицы «Запланировано» — Dumb UI компонент с `isLoading` prop, `animate-pulse` скелет
UX-DR7: Responsive datetime picker — нативный `<input type="datetime-local">` (полноэкранный на iOS Safari), inline на десктопе
UX-DR8: Таблица «Запланировано» на узких экранах — `overflow-x-auto` горизонтальный скролл
UX-DR9: Дизайн-токены design system — `--primary` (Muted Terracotta) для активного состояния toggle, `--destructive` для кнопки «Отменить публикацию»

---

## Change Requirements Inventory — Temporary One-Time Access (2026-09-01)

### Functional Requirements — Temporary Offer Change

FR1.4: В период `[2026-09-01 00:00, 2026-12-01 00:00) Europe/Ljubljana` новым покупательницам доступен только разовый Stripe-платёж 29€ за 3 календарных месяца доступа к существующей базе; действующие recurring-подписки не изменяются.
FR1.4.1: Временное предложение не содержит выбора тарифов, recurring-платежей, автопродления, помесячного расчёта, отмены подписки или обещания регулярной публикации нового контента.
FR1.4.2: Временное entitlement создаётся только после подтверждённой оплаты и claim по тому же нормализованному verified email; доступ действует на полуинтервале `[paid_at, paid_at + 3 calendar months)`.
FR1.4.3: Текущие `active`/`trialing` подписчицы не видят и не могут оформить временное предложение; бывшие подписчицы без действующей recurring-подписки допускаются.
FR3.1: Временный доступ автоматически прекращается при `now() == access_ends_at`; окончание публичного offer window не сокращает уже выданный доступ.
FR5.1: В момент cutoff система прекращает temporary redirects, возвращает исходные recurring UI/checkout и обеспечивает деактивацию временного Payment Link, сохраняя все ранее выданные entitlements до их индивидуального срока.
FR8: CTA лендинга ведёт к оплате, соответствующей server-derived коммерческой модели и eligibility пользователя.
FR27: Пользовательницы с действующим temporary entitlement входят в email audience новых публикаций при сохранении существующих email preferences и audience rules.

### Non-Functional Requirements — Temporary Offer Change

NFR7: Access cache и сессии не могут сохранять доступ после `access_ends_at`; recurring revocation latency остаётся не хуже 60 секунд.
NFR8: Любой Stripe webhook проверяется по signature на raw body до чтения payment payload.
NFR9: Платформа не принимает и не хранит карточные данные; Payment Link и Checkout остаются Stripe-hosted.
NFR13: Retention и redaction purchaser email, unclaimed entitlements и payment audit должны быть формально утверждены с учётом GDPR и требований к платёжным записям.
NFR14: Temporary pricing, post-payment, pending и inactive states соответствуют WCAG 2.1 AA.
NFR15: Pricing copy, old price, CTA, focus и status states сохраняют контраст не менее 4.5:1 и не зависят только от цвета.
NFR17: Pricing CTA и post-payment flow полностью доступны с клавиатуры на desktop.
NFR18: Retry и параллельная доставка одного Checkout Session создают максимум один grant и не продлевают `access_ends_at`.
NFR19: Ошибки fulfillment и business exceptions логируются с безопасными `event.id`/`session.id` и доступны для reconciliation без раскрытия платёжных данных.
NFR19.1: Ошибка temporary redirect/checkout показывает понятное словенское сообщение, не выполняет повторный переход автоматически и минимизирует риск двойной оплаты.
NFR20: Временные участницы получают уведомления о публикациях в пределах существующего SLA 5 минут.
NFR21: Расширение recipient selection не ухудшает существующий email delivery rate ≥ 95%.

### Additional Requirements — Temporary Offer Change

- Использовать один server-only `TemporaryOfferConfig` для start/end/timezone, environment, offer code/version, exact Link/Price IDs, amount, currency, quantity и metadata; mixed или incomplete config должен fail closed.
- Не создавать и не менять recurring Stripe Price, Payment Link, Subscription или contract `/api/checkout` для `monthly|quarterly`; one-time flow пишет только в собственные сущности.
- Перед production enablement read-only подтвердить отдельные test/live one-time Price и Payment Link: `mode='payment'`, 29.00 EUR, quantity 1, отсутствие recurring/trial и корректные metadata/redirect.
- Temporary Link URL выдаётся только server-side redirect gate внутри canonical offer window; UI получает только server-derived mode, а сохранённый direct Link закрывается операционной деактивацией в cutoff.
- Signed webhook повторно получает Checkout Session server-side с expanded `line_items` и проверяет exact Link, Price, metadata, amount, currency, quantity, `mode='payment'` и paid status по allowlist.
- `checkout.session.completed` исполняет fulfillment только при `payment_status='paid'`; delayed methods используют тот же `fulfillTemporaryOffer(sessionId)` через `checkout.session.async_payment_succeeded`.
- `paid_at` берётся из `event.created` единственного qualifying paid event; receipt order и retry не меняют timestamp.
- Создать append-only `payment_fulfillment_attempts`, отдельный grant ledger `access_entitlements` и независимый mutable `payment_refund_cases`; audit/refund state не участвует в access predicate.
- `access_entitlements` хранит nullable `user_id`, immutable offer/payment attribution, `paid_at`, `access_starts_at`, `access_ends_at`, `claimed_at`, `revoked_at` и unique `fulfillment_attempt_id`; client-side DML запрещён.
- Уникальность `stripe_checkout_session_id`, nullable `stripe_payment_intent_id` и `(offer_code, purchaser_email_normalized)` должна предотвращать retry, parallel delivery и несколько grant для одного email/offer; проигравшая distinct Session уходит в `duplicate_review`.
- Authoritative purchaser identity берётся только из retrieved `Checkout Session.customer_details.email` и нормализуется как `lower(btrim(email))`; отсутствие email создаёт non-granting exception.
- `access_ends_at` вычисляется один раз в DB transaction как три календарных месяца в `Europe/Ljubljana`, сохраняется как `timestamptz`; 90 дней использовать нельзя, правая граница exclusive.
- Atomic claim связывает только webhook-issued `unclaimed` entitlement с `auth.uid()`, если verified `auth.users.email` точно совпадает после `lower(btrim(...))`; provider aliasing и создание entitlement из redirect запрещены.
- Если webhook ещё не доставлен, post-payment UX показывает pending state и безопасно повторяет claim, не создавая право из `{CHECKOUT_SESSION_ID}` или Stripe redirect.
- Один private DB access-state resolver является Policy Decision Point для admin, VIP, recurring и temporary sources; middleware, RLS и email recipient selection используют его через строго ограниченные wrappers/RPC.
- Полный PEP inventory включает RLS для posts/media/comments/likes, mutation policies, content RPC, protected Storage objects, views и public `SECURITY DEFINER` functions; legacy access checks должны быть заменены canonical resolver.
- Signed HttpOnly access cache привязывается к `user_id`, содержит canonical `sources` и `valid_until_epoch`, а его TTL ограничивается entitlement deadline; cache никогда не является источником access truth.
- Profile authorization fields (`role`, `is_vip`, recurring Stripe/status fields) и entitlement/audit tables недоступны self-service mutation; trusted writes выполняются только server/service-role paths с минимальными GRANT.
- После cutoff UI и redirect gate автоматически возвращают recurring baseline; late webhook может создать grant только если immutable qualifying `paid_at` находился внутри offer window.
- Duplicate/ineligible/out-of-window paid Sessions не получают доступ и проходят утверждённый refund/support lifecycle с идемпотентным Stripe refund key; production запрещён до утверждения policy, SLA и customer communication.
- Launch go/no-go требует controlled payment → attempt → claim → middleware/RLS/email smoke, unchanged recurring fixtures и rollback rehearsal; critical mismatch автоматически закрывает temporary redirect gate, не отключая recurring или уже claimed access.
- До реализации/launch нужны зафиксированные approvals Owner/PM и Architect для Major change, exact Stripe config, schema/RLS/GRANT matrix, refund policy, VIP/admin eligibility, Slovene copy, GDPR retention и rollback operator/runbook.
- До implementation/launch обновить Next.js с уязвимого seed `16.1.6` минимум до актуальной patched версии, отдельно сверив official advisories в момент выполнения.

### UX Design Requirements — Temporary Offer Change

UX-DR9.1: Внутри offer window pricing surface показывает одну карточку без radiogroup или plan selector; вне окна автоматически возвращается исходная двухтарифная interaction model.
UX-DR9.2: Карточка отображает `€29,00 / 3 mesece`, семантически зачёркнутую `€34,00` и строку `Dostop do obstoječe baze znanja za 3 mesece.`
UX-DR9.3: Temporary UI не содержит `MESEČNO`, `€12,99`, `/ mesec`, `≈`, `Prihranek`, cancellation/autorenewal copy или обещания `Izobraževalne vsebine 3-4x na teden`.
UX-DR9.4: CTA имеет доступное имя `Pridruži se zdaj`, ведёт только через server-side eligibility/time gate и блокирует повторный переход во время обработки.
UX-DR9.5: Post-payment flow объясняет verified-email claim, pending webhook state, индивидуальную дату окончания доступа и отсутствие автопродления; `session_id` используется только как UX hint.
UX-DR9.6: Inactive/expired state ясно сообщает об окончании временного доступа и предлагает только актуальную на этот момент коммерческую модель.
UX-DR9.7: Текущие `active`/`trialing` подписчицы не видят temporary CTA; бывшие подписчицы без активного recurring доступа видят его на общих условиях.
UX-DR9.8: На 375px, 768px и ≥1024px отсутствует горизонтальное переполнение, CTA имеет touch target не меньше 44×44 px, а layout сохраняет Warm Minimalism и editorial outline hierarchy.
UX-DR9.9: Keyboard focus видим на CTA и post-payment controls; зачёркнутая цена доступна семантически, а различия состояний не передаются только цветом.
UX-DR9.10: Loading, pending, invalid/ineligible и network-error states используют существующие Skeleton/inline/Toast patterns и словенский user-facing copy.

---

## Epic List

### Epic 1: Growth & Conversion (Landing, Subscriptions & Onboarding)
Посетительницы могут изучить ценность клуба через превью-посты на лендинге, оформить платную подписку через Stripe и пройти бесшовный онбординг (включая присоединение к WhatsApp-комьюнити). Этап включает техническую инициализацию проекта (Next.js, Supabase, Tailwind, Vercel).
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13

### Epic 2: Knowledge Discovery (Content Feed, Multimedia & Archive)
Участницы могут просматривать ленту мультимедийных постов (текст, фото, видео, галереи до 10 элементов), использовать горизонтальные фильтры-рубрики, просматривать адаптивные галереи (`GalleryGrid`) и искать контент в 2-летнем архиве. Включает нормализованную модель данных `post_media`, глобальный видеоконтроллер (NFR4.1) и оптимизированные запросы (NFR5).
**FRs covered:** FR14, FR15, FR16, FR16.1, FR17, FR18

### Epic 3: Community Engagement (Discussions & Notifications)
Участницы могут общаться друг с другом и с автором через плоские ветки комментариев, а также оставаться вовлеченными благодаря автоматическим email-уведомлениям о новых постах.
**FRs covered:** FR23, FR24, FR25, FR26, FR27, FR28

### Epic 4: Creator Operations (Admin Dashboard)
Автор платформы может публиковать мультиформатный контент (до 10 медиафайлов с выбором обложки и порядка), управлять категориями, назначать посты для онбординга и мониторить статусы подписок участниц. RLS-политики обеспечивают, что только автор (admin) может создавать и редактировать записи `post_media`.
**FRs covered:** FR19, FR20, FR21, FR22, FR32, FR33, FR34, FR35

### Epic 5: Platform Initialization (Telegram Migration)
Администратор может разово импортировать всю историю постов и медиа из Telegram-канала, включая интеллектуальную группировку медиагрупп в единые галереи. Скрипт поддерживает Exponential Backoff со стейт-переходами (cursor) при ошибках Rate Limit от Telegram API (NFR19.2).
**FRs covered:** FR29, FR30, FR31

### Epic 6: Scheduled Publishing — Автор планирует выход контента
Автор может подготовить посты заранее, назначить время публикации через toggle + datetime picker в стандартной форме создания/редактирования поста, и они выйдут автоматически в назначенный момент с email-рассылкой участникам — без присутствия автора онлайн. Раздел «Запланировано» в admin-панели даёт полный контроль над расписанием: просмотр, редактирование и отмена запланированных постов.
**FRs covered:** FR6.1–FR6.18
**Stories:** 6.1 (Schema Migration) → 6.2 (pg_cron Automation) → 6.3 (UI Form Extension) → 6.4 (Admin Scheduled Table)

### Epic 7: Rich Content Experience (WYSIWYG HTML Content & Inline Media)
Автор создаёт посты с форматированным rich-text article body и встроенными инлайн-изображениями через WYSIWYG-редактор; участницы видят корректно скомпонованный контент с sanitize + HTML render path, lazy loading изображений и правильным комбинированным layout (article body + галерея).
**FRs covered:** FR19.1, FR16.2, NFR4.2
**Stories:** 7.1 (WYSIWYG Editor) → 7.2 (HTML Renderer & Combined Layout)

### Epic 8: Video Thumbnails — Avtomatska in ročna upravljanje posterjev za video
Sistem avtomatsko generira poster (thumbnail) iz prvega kadra video posnetka, če `thumbnail_url` manjka — ob shranjevanju objave ali retroaktivno za obstoječe zapise. Avtor v editorju lahko ročno izbere poljubno sliko kot poster ali ponovno generira avtomatski. Admin lahko zažene masovno obdelavo za vse video posnetke brez posterja (npr. po Telegram migraciji). LazyMediaWrapper in GalleryGrid uporabljata `thumbnail_url` za privlačen predogled v lenti.
**FRs covered:** FR8.1–FR8.7
**Stories:** 8.1 (Avtomatsko generiranje ob shranjevanju) → 8.2 (Ročna zamenjava v editorju) → 8.3 (Retroaktivna obdelava) → 8.4 (Ponovno generiranje in brisanje)

### Epic 9: Временное предложение и ограниченный по сроку разовый доступ
Новая или бывшая участница без действующей recurring-подписки может один раз оплатить €29,00 и безопасно получить доступ к существующей базе на три календарных месяца. Действующие подписчицы сохраняют текущий subscription lifecycle, а после cutoff автоматически возвращается исходная recurring-модель без сокращения ранее выданного временного доступа.
**FRs covered:** FR1.4, FR1.4.1, FR1.4.2, FR1.4.3, FR3.1, FR5.1, FR8 (temporary branch), FR27 (temporary branch)

## Epic 1: Growth & Conversion (Landing, Subscriptions & Onboarding)

Посетительницы могут изучить ценность клуба через превью-посты на лендинге, оформить платную подписку через Stripe и пройти бесшовный онбординг (включая присоединение к WhatsApp-комьюнити). Этап включает техническую инициализацию проекта (Next.js, Supabase, Tailwind, Vercel).

### Story 1.1: Базовый лендинг и технический фундамент (Infrastructure)

As a посетительница,
I want быстро и безопасно открыть главную страницу платформы,
So that я могла ознакомиться с клубом без задержек и технических проблем.

**Acceptance Criteria:**

**Given** пустой репозиторий и развернутая инфраструктура (Vercel, Supabase)
**When** пользователь открывает корневой маршрут (`/`)
**Then** быстро загружается базовая страница-заглушка или каркас лендинга
**And** настроен Next.js (App Router), Tailwind CSS и ESLint (без правила camelcase для БД)
**And** метрики производительности (LCP, TTI) соответствуют NFR
**And** проект успешно деплоится на Vercel

### Story 1.2: Регистрация и Вход на платформу (Email & Password Auth)

As a пользовательница,
I want иметь возможность создать аккаунт через уникальную ссылку-приглашение и входить на платформу по email и паролю,
So that легко и безопасно получать доступ к своему профилю.

**Acceptance Criteria:**

**Given** процесс первоначальной регистрации после оплаты
**When** пользователь вводит email при оплате в Stripe
**Then** на почту приходит письмо с уникальной ссылкой для подтверждения email и создания пароля
**And** при переходе по ссылке открывается страница установки пароля
**And** после установки пароля происходит авторизация и выдается session token (JWT)
**And** при последующих входах пользователь вводит email и придуманный пароль на странице `/login`
**And** при вводе неверного пароля отображается понятная ошибка интерфейса
**And** инкрементально создается таблица `profiles` для хранения данных участниц

### Story 1.3: Публичный лендинг (Landing Page UI)

As a незарегистрированная посетительница,
I want видеть ценностное предложение, отзывы и превью-посты на главной странице,
So that понять ценность комьюнити перед покупкой.

**Acceptance Criteria:**

**Given** неавторизованный доступ к корню сайта (`/`)
**When** загружается страница
**Then** отображается лендинг с дизайном "Mobile-First"
**And** видны блок с отзывами (вертикальный список карточек) и статичные карточки превью-постов


### Story 1.4: Интеграция Stripe Checkout

As a посетительница,
I want нажать кнопку оплаты на лендинге и выбрать тариф (12,99€/мес или 34€/3 мес),
So that оформить подписку через надежный шлюз Stripe.

**Acceptance Criteria:**

**Given** лендинг с кнопками призыва к действию
**When** посетительница нажимает "Вступить"
**Then** происходит перенаправление на защищенную сессию Stripe Checkout
**And** доступны оба варианта тарифов подписки
**And** при таймауте или ошибке Stripe API отображается дружелюбное сообщение с рекомендацией повторить попытку позже (NFR19.1)

### Story 1.5: Обработка Stripe Webhooks и управление доступом

As a система,
I want получать события от Stripe (оплата, отмена) через Webhooks,
So that автоматически открывать или закрывать доступ к контенту платформы.

**Acceptance Criteria:**

**Given** запущенный API маршрут `/api/webhooks/stripe`
**When** Stripe присылает событие `checkout.session.completed` или `invoice.payment_succeeded`
**Then** статус пользователя в БД обновляется на `active`
**And** создается/обновляется таблица или записи для хранения данных о `subscriptions` участницы
**And** при событии `customer.subscription.deleted` доступ автоматически блокируется
**And** после потери доступа сессия инвалидируется в течение 60 секунд (NFR7)
**And** обработка webhook-событий идемпотентна — повторная доставка одного события не создаёт дублей (NFR18)

### Story 1.6: Onboarding-страница для новых участниц

As a новая участница,
I want после первой успешной оплаты попадать на страницу "Начни здесь" с топ-постами и ссылкой на WhatsApp,
So that сразу вовлечься в жизнь комьюнити.

**Acceptance Criteria:**

**Given** успешная первая оплата в Stripe
**When** пользователь возвращается на сайт (success url)
**Then** она перенаправляется на специальный роут онбординга
**And** видит приветствие, ссылку для перехода в WhatsApp и список "Топ-5 постов"

### Story 1.7: Личный кабинет и управление подпиской

As a участница,
I want иметь возможность зайти в настройки и просмотреть/отменить свою подписку,
So that полностью контролировать свои платежи.

**Acceptance Criteria:**

**Given** авторизованная участница
**When** она открывает раздел профиля
**Then** отображается текущий статус её подписки
**And** присутствует кнопка перехода в Stripe Customer Portal для управления биллингом

### Story 1.8: Сброс и восстановление пароля (Forgot Password)

As a участница,
I want запросить ссылку для сброса пароля, если я его забыла,
So that восстановить доступ к своему профилю.

**Acceptance Criteria:**

**Given** страница авторизации (`/login`)
**When** пользователь нажимает "Забыли пароль?" и вводит свой email
**Then** система отправляет письмо со ссылкой для сброса пароля (через Supabase Auth)
**And** при переходе по ссылке из письма открывается страница `Update Password`
**And** после ввода нового пароля происходит обновление credentials и авторизация
**And** если email не существует в системе, пользователь видит нейтральное сообщение "Если email зарегистрирован, вы получите письмо" (prevent user enumeration)

## Epic 2: Knowledge Discovery (Content Feed, Multimedia & Archive)

Участницы могут просматривать ленту мультимедийных постов (текст, фото, видео, галереи до 10 элементов), использовать горизонтальные фильтры-рубрики, просматривать адаптивные галереи (`GalleryGrid`) и искать контент в 2-летнем архиве. Включает нормализованную модель данных `post_media`, глобальный видеоконтроллер и оптимизированные запросы.

### Story 2.1: Нормализованная модель данных для мультимедиа (Database Schema)

As a разработчик,
I want создать нормализованную таблицу `post_media` для хранения медиафайлов,
So that поддерживать посты с галереями до 10 элементов и масштабировать систему.

**Acceptance Criteria:**

**Given** существующая схема БД с таблицей `posts`
**When** выполняется SQL-миграция
**Then** создаётся таблица `post_media` с полями: `id` (UUID PK), `post_id` (FK → posts.id, CASCADE ON DELETE), `media_type` (ENUM: image/video), `url` (TEXT), `thumbnail_url` (TEXT, для видео), `order_index` (INTEGER), `is_cover` (BOOLEAN)
**And** ограничение: максимум 10 записей `post_media` на один пост
**And** существующие данные `image_url` из старой таблицы `posts` корректно мигрированы в `post_media`
**And** настроены RLS-политики по матрице RBAC: только автор (admin) может INSERT/UPDATE/DELETE записи `post_media`, участницы с активной подпиской — только SELECT
**And** оптимизированы индексы для JOIN-запросов с таблицей `posts`, обеспечивая 95th percentile response time ≤ 500ms (NFR5)

### Story 2.2: Базовая лента контента с бесконечным скроллом (Infinite Scroll)

As a участница,
I want просматривать ленту постов в хронологическом порядке,
So that быть в курсе новых материалов клуба.

**Acceptance Criteria:**

**Given** авторизованная участница на главной странице приложения (`/feed`)
**When** она скроллит страницу вниз
**Then** посты подгружаются порциями автоматически (infinite scroll)
**And** во время ожидания данных отображаются встроенные в карточку Skeleton-плейсхолдеры
**And** стейт ленты кэшируется через Zustand для мгновенного возврата
**And** запросы ленты включают JOIN с таблицей `post_media` для получения всех медиа каждого поста
**And** RBAC: только авторизованные участницы с активной подпиской видят ленту (RLS на уровне Supabase)

### Story 2.3: Оптимизированное отображение медиа в карточках (LazyMediaWrapper)

As a участница,
I want чтобы фото и превью видео загружались только тогда, когда я до них доскроллю,
So that приложение работало быстро и не тратило мобильный трафик зря.

**Acceptance Criteria:**

**Given** лента контента с тяжелыми медиафайлами
**When** карточка с медиа приближается к области видимости экрана
**Then** срабатывает отложенная загрузка (`LazyMediaWrapper`)
**And** изображения отдаются через оптимизированный `next/image`
**And** вместо не загруженного медиа отображается мягкий серый фон

### Story 2.4: Компонент галереи с адаптивной сеткой (GalleryGrid)

As a участница,
I want видеть медиа в посте-галерее в красивой адаптивной сетке,
So that удобно просматривать все фото и видео поста.

**Acceptance Criteria:**

**Given** пост содержит от 2 до 10 медиафайлов (записи `post_media` с `order_index`)
**When** участница открывает пост или видит его карточку в ленте
**Then** компонент `GalleryGrid` (Dumb UI) рендерит медиа по правилам из FR16.1:
  - 2–4 элемента → адаптивная сетка
  - 5 элементов → сетка 2×3
  - 6 элементов → сетка 3×3
  - 7–10 элементов → сетка 2×2 (первые 4), остальные ниже в формате карусели
**And** компонент принимает проп `isLoading` и рендерит собственное Skeleton-состояние
**And** порядок медиа сохраняется согласно `order_index`
**And** для постов с одним медиа галерея НЕ рендерится — используется стандартное отображение (Image или VideoPlayer)
**And** компонент покрыт юнит-тестами для всех вариаций (1, 2, 3, 4, 5, 6, 7, 8, 9, 10 элементов)

### Story 2.5: Глобальный менеджер воспроизведения видео (Video Controller)

As a участница,
I want чтобы при скролле ленты автоматически останавливалось предыдущее видео при запуске нового,
So that не тратить ресурсы устройства и фокусироваться на одном видео.

**Acceptance Criteria:**

**Given** лента или пост с несколькими видеофайлами
**When** участница запускает воспроизведение видео
**Then** любое ранее воспроизводимое видео автоматически ставится на паузу
**And** одновременно воспроизводится не более одного видео (NFR4.1)
**And** состояние воспроизведения хранится в Zustand store (`src/features/feed/store.ts`)
**And** Smart Container (`FeedContainer`) управляет логикой контроля видео при скролле

### Story 2.6: Детальный просмотр мультиформатного поста

As a участница,
I want открывать конкретный пост для полноценного чтения, просмотра галереи или видео,
So that изучить материал полностью.

**Acceptance Criteria:**

**Given** карточка поста в общей ленте
**When** участница тапает по карточке
**Then** открывается полная версия поста
**And** интерфейс корректно отрисовывает контент в зависимости от типа (Rich Text, Video Player, `GalleryGrid`)
**And** для постов-галерей все медиа отображаются с учётом правил FR16.1
**And** присутствует удобная кнопка возврата (Back), которая возвращает в ленту на ту же позицию скролла
**And** поддерживается Open Graph `og:image` на основе обложки (медиа с `is_cover=true` или первый элемент галереи)

### Story 2.7: Поиск по всей базе знаний

As a участница,
I want вводить ключевые слова в строку поиска,
So that находить конкретные советы или разборы среди всех публикаций и архива.

**Acceptance Criteria:**

**Given** активная нижняя навигация (Bottom Bar)
**When** участница переходит во вкладку "Поиск" и вводит запрос
**Then** происходит поиск по заголовкам, текст и тегам в БД (Supabase Full Text Search)
**And** результаты отображаются в виде списка карточек, при клике на которые открывается полный пост
**And** в случае отсутствия результатов отображается дружелюбное "Пустое состояние" (Empty State)

### Story 2.8: Горизонтальные фильтры-рубрики (Sticky Pill Filters)

As a участница,
I want выбирать конкретную рубрику (например, #insight) на закрепленной верхней панели,
So that мгновенно отфильтровать ленту и убрать лишнее.

**Acceptance Criteria:**

**Given** закрепленный (sticky) заголовок на экране ленты
**When** участница скроллит категории горизонтально и нажимает на одну из "таблеток" (Pill)
**Then** "таблетка" подсвечивается акцентным цветом
**And** лента мгновенно обновляется (фильтруется), показывая только посты выбранной категории
**And** при возврате на фильтр "Все" лента возвращается в исходное состояние

## Epic 3: Community Engagement (Discussions & Notifications)

Участницы могут общаться друг с другом и с автором через плоские ветки комментариев, а также оставаться вовлеченными благодаря автоматическим email-уведомлениям о новых постах.

### Story 3.1: Просмотр обсуждений под постом

As a участница,
I want видеть список всех комментариев под постом с аватарами и бейджами статуса,
So that понимать контекст обсуждения и опыт других участниц.

**Acceptance Criteria:**

**Given** открытый детальный пост с существующими комментариями
**When** участница доскролливает до секции обсуждения
**Then** отображается список комментариев в хронологическом порядке
**And** дизайн использует плоский список с визуальным отступом (максимум 1 уровень вложенности для ответов)
**And** у каждого комментария виден аватар и бейдж (если применимо, например, "Автор")

### Story 3.2: Написание комментария с мгновенным откликом (Optimistic UI)

As a участница,
I want написать свой комментарий или вопрос,
So that получить помощь от комьюнити.

**Acceptance Criteria:**

**Given** поле ввода комментария под постом
**When** участница вводит текст и нажимает "Отправить"
**Then** комментарий мгновенно появляется в списке (Optimistic update)
**And** система отправляет запрос в Supabase для сохранения
**And** в случае ошибки сети, комментарий помечается красным с предложением "Повторить отправку"

### Story 3.3: Модерация и ответы на комментарии (Админ-функции)

As a автор,
I want иметь возможность отвечать конкретным участницам или удалять неуместные комментарии,
So that поддерживать здоровую и полезную атмосферу в клубе.

**Acceptance Criteria:**

**Given** авторизованный пользователь с ролью `admin`
**When** она просматривает ветку комментариев
**Then** под каждым чужим комментарием доступна кнопка "Ответить" и иконка "Удалить" (Trash)
**And** при удалении комментарий скрывается из базы и интерфейса с подтверждением через Toast
**And** ответ автора визуально выделяется (например, акцентной рамкой или бейджем)

### Story 3.4: Автоматические Email-уведомления о новых постах

As a участница,
I want получать красивое письмо на email каждый раз, когда выходит новый пост,
So that не пропустить важный контент, даже если я не заходила на платформу.

**Acceptance Criteria:**

**Given** статус подписки "активен"
**When** автор публикует новый пост (Trigger)
**Then** система автоматически отправляет email-уведомление через провайдера рассылок
**And** письмо содержит заголовок поста и ссылку для перехода на платформу
**And** доставка происходит в течение 5 минут после публикации

### Story 3.5: Управление email-предпочтениями

As a участница,
I want иметь возможность отписаться от рассылок,
So that контролировать входящий поток писем.

**Acceptance Criteria:**

**Given** авторизованная участница в разделе настроек профиля
**When** она переключает тумблер "Email-уведомления"
**Then** её предпочтение сохраняется в базе данных
**And** система исключает её из будущих рассылок о новых постах
**And** в каждом получаемом письме также присутствует рабочая ссылка "Unsubscribe"

## Epic 4: Creator Operations (Admin Dashboard)

Автор платформы может публиковать мультиформатный контент (до 10 медиафайлов с выбором обложки и порядка), управлять категориями, назначать посты для онбординга и мониторить статусы подписок участниц. RLS-политики обеспечивают, что только автор (admin) может создавать и редактировать записи `post_media`.

### Story 4.1: Создание и редактирование мультимедийных постов

As a автор,
I want создавать новые посты, загружая до 10 медиафайлов (фото/видео) с возможностью выбора обложки и порядка,
So that делиться знаниями в различных мультимедийных форматах.

**Acceptance Criteria:**

**Given** авторизованный пользователь с ролью `admin` в разделе создания поста
**When** она заполняет форму (заголовок, текст) и загружает медиафайлы (через Supabase Storage)
**Then** пост сохраняется в таблице `posts`, медиафайлы — в таблице `post_media` с корректным `order_index`
**And** автор может загрузить от 1 до 10 медиафайлов (фото, видео или комбинация)
**And** автор может перетаскиванием (drag-and-drop) изменить порядок медиа
**And** автор может отметить один из медиафайлов как обложку (`is_cover=true`) для SEO/OG-тэгов
**And** при необходимости пост можно открыть для редактирования и внести изменения (включая добавление/удаление/перестановку медиа)
**And** статус поста устанавливается как "опубликован"

### Story 4.2: Управление категориями и рубриками постов

As a автор,
I want создавать рубрики и присваивать их постам при публикации,
So that структурировать базу знаний.

**Acceptance Criteria:**

**Given** интерфейс управления постами или настройками
**When** автор добавляет новую категорию (например, "#insight")
**Then** категория сохраняется в список доступных тегов
**And** при публикации поста автор может выбрать одну из существующих категорий из выпадающего списка

### Story 4.3: Управление контентом для Onboarding и Лендинга

As a автор,
I want выбирать конкретные посты как "превью для лендинга" или "Топ-5 для новичков", а также обновлять ссылку на WhatsApp,
So that управлять первым впечатлением участниц.

**Acceptance Criteria:**

**Given** страница редактирования конкретного поста
**When** автор включает чекбокс "Показывать на лендинге" или "Добавить в Топ-5 Onboarding"
**Then** пост закрепляется в соответствующих разделах
**And** в глобальных настройках доступно поле для ввода актуальной ссылки на WhatsApp

### Story 4.4: Мониторинг участниц и ручное управление доступом

As a автор,
I want видеть список всех зарегистрированных участниц с их статусом в Stripe и при необходимости вручную выдавать/забирать доступ,
So that решать спорные ситуации с платежами.

**Acceptance Criteria:**

**Given** вкладка "Участницы" в админ-панели
**When** автор открывает список
**Then** отображается таблица/список пользователей с их email, датой регистрации и статусом подписки (active/canceled)
**And** присутствует кнопка ручного переключения статуса доступа пользователя (bypass Stripe logic)

### Story 4.5: Навигация в интерфейсе администратора

As a автор (admin),
I want иметь удобную навигацию по всем разделам административного интерфейса,
So that перемещаться между страницами создания постов, управления категориями и настройками без ручного ввода URL.

**Acceptance Criteria:**

**Given** авторизованный пользователь с ролью `admin` открывает любую страницу в `/admin/*`
**When** страница рендерится
**Then** отображается `AdminSidebar` с ссылками: "Nova objava" (`/admin/posts/create`), "Kategorije" (`/admin/categories`), "Nastavitve" (`/admin/settings`)
**And** активный пункт выделен визуально, ссылка возврата "Aplikacija" → `/feed` доступна

**Given** авторизованный admin просматривает страницу в `(app)` на десктопе
**When** рендерится `DesktopSidebar`
**Then** в нижней части sidebar отображается секция "Administracija" с admin-ссылками (только для admin)

**Given** авторизованный admin открывает `/profile` на мобильном
**When** `ProfileScreen` рендерится
**Then** отображается секция "Administracija" с кнопками-ссылками для admin-функций (только для admin)

**FRs covered:** FR19, FR20, FR21, FR22 (навигационная поддержка Creator Operations)

## Epic 5: Platform Initialization (Telegram Migration)

Администратор может разово импортировать всю историю постов и медиа из Telegram-канала, включая интеллектуальную группировку медиагрупп в единые галереи с использованием нормализованной таблицы `post_media`. Скрипт поддерживает резамерный запуск с Exponential Backoff и сохранением стейта.

### Story 5.1: Доступ ко всему архиву контента (Telegram Migration)

As a участница,
I want иметь доступ ко всем старым публикациям клуба, начиная с первого дня,
So that я могла изучить весь накопленный полезный опыт и материалы прошлых лет.

**Acceptance Criteria:**

**Given** файл экспорта из Telegram (JSON + папка с медиа) и развернутая база данных с таблицами `posts` и `post_media`
**When** администратор запускает идемпотентный скрипт миграции `scripts/telegram_migration.ts`
**Then** скрипт читает JSON и переносит исторические публикации в платформу с оригинальными датами
**And** медиагруппы (grouped_id) из Telegram объединяются в единые посты-галереи с корректным `order_index` в `post_media`
**And** медиафайлы загружаются в Supabase Storage и связываются с постами через таблицу `post_media`
**And** при ошибке Rate Limit или Timeout от Telegram API скрипт сохраняет cursor (последнюю успешную точку) и приостанавливается с Exponential Backoff (NFR19.2)
**And** повторный запуск скрипта не дублирует уже загруженные посты (идемпотентность)
**And** Telegram-архив после импорта является иммутабельной записью (NFR24)

## Epic 6: Scheduled Publishing — Автор планирует выход контента

Автор может подготовить посты заранее, назначить время публикации через toggle + datetime picker в стандартной форме создания/редактирования поста, и они выйдут автоматически в назначенный момент с email-рассылкой участникам — без присутствия автора онлайн. Раздел «Запланировано» в admin-панели даёт полный контроль над расписанием: просмотр, редактирование и отмена запланированных постов.

### Story 6.1: Схема БД — статусная модель постов

As a автор,
I want новые поля `status`, `scheduled_at`, `published_at` в таблице постов,
So that система может отслеживать статус публикации и управлять очередью запланированных постов.

**Acceptance Criteria:**

**Given** существующая таблица `posts` в production БД
**When** применяется миграция через Supabase
**Then** добавлено поле `status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published'))`
**And** добавлено поле `scheduled_at TIMESTAMPTZ` (nullable)
**And** добавлено поле `published_at TIMESTAMPTZ` (nullable)
**And** создан частичный индекс `CREATE INDEX idx_posts_scheduled ON posts(scheduled_at) WHERE status = 'scheduled'`
**And** существующие посты получают `status='published'` через backfill-часть миграции (`UPDATE posts SET status='published' WHERE status IS NULL`)

**Given** RLS-политики Supabase для таблицы `posts`
**When** участник (не admin) пытается изменить `status`, `scheduled_at` или `published_at`
**Then** Supabase возвращает ошибку — RLS запрещает изменение этих полей для роли `authenticated` без `is_admin=true`

**Given** обновлена схема БД
**When** выполнен `supabase gen types typescript`
**Then** TypeScript-типы отражают новые поля (`status`, `scheduled_at`, `published_at`) в snake_case

### Story 6.2: pg_cron — Автоматическая публикация запланированных постов

As a автор,
I want посты со статусом `scheduled` автоматически публиковались в назначенное время,
So that контент выходит без моего присутствия онлайн, а участницы получают стандартное email-уведомление.

**Acceptance Criteria:**

**Given** pg_cron extension включён в Supabase проекте и переменная `CRON_SECRET` задана в `.env`
**When** создан Route Handler `POST /api/cron/publish` и зарегистрирована pg_cron задача `cron.schedule('*/5 * * * *', ...)`
**Then** каждые 5 минут pg_cron вызывает endpoint с заголовком `Authorization: Bearer {CRON_SECRET}`

**Given** входящий запрос на `POST /api/cron/publish`
**When** заголовок `Authorization` отсутствует или содержит неверный секрет
**Then** endpoint возвращает `401 Unauthorized` (NFR6.4)

**Given** валидный запрос к `POST /api/cron/publish`
**When** выполняется атомарный SQL: `UPDATE posts SET status='published', published_at=now() WHERE status='scheduled' AND scheduled_at <= now() AND published_at IS NULL RETURNING id`
**Then** все созревшие посты публикуются за одну транзакцию — race condition исключён (NFR6.13)
**And** для каждого опубликованного поста запускается существующий Resend email-механизм для уведомления участников (FR6.17)

**Given** повторный запуск pg_cron через 5 минут
**When** пост уже имеет `published_at IS NOT NULL`
**Then** SQL-условие `published_at IS NULL` исключает его из выборки — повторный email не отправляется (FR6.18, NFR6.7)

**Given** несколько постов созрели одновременно
**When** один из них вызывает ошибку при отправке email (например, сбой Resend)
**Then** ошибка логируется, но остальные посты публикуются и получают email — изоляция через try/catch per post (NFR6.9)

**Given** Supabase downtime продолжался менее 24 часов
**When** pg_cron возобновляет работу
**Then** условие `scheduled_at <= now()` захватывает все пропущенные посты и публикует их при следующем запуске (FR6.11, NFR6.8)

### Story 6.3: UI — Toggle «Запланировать» + datetime picker в форме поста

As a автор,
I want переключиться в режим «Запланировать» в форме создания/редактирования поста и выбрать дату и время,
So that пост сохраняется со статусом `scheduled` и появится в ленте автоматически в назначенное время.

**Acceptance Criteria:**

**Given** автор открыл форму создания или редактирования поста
**When** смотрит на секцию публикации
**Then** видит toggle с двумя состояниями: «Опубликовать сейчас» (по умолчанию) и «Запланировать»
**And** toggle имеет `aria-pressed` и `min-h-[44px] min-w-[44px]` (UX-DR1, UX-DR2)

**Given** toggle переключён в «Запланировать»
**When** секция публикации перерендеривается
**Then** появляется `<input type="datetime-local">` с `aria-label="Дата и время публикации"` и `aria-describedby` на preview-элемент
**And** под полем отображается preview-текст «Пост будет опубликован [дата] в [время] ([timezone])» через `Intl.DateTimeFormat` (FR6.3)
**And** элементы datetime picker имеют `min-h-[44px] min-w-[44px]` (UX-DR1)

**Given** автор вводит время в прошлом или оставляет поле пустым и нажимает «Сохранить»
**When** срабатывает client-side валидация
**Then** форма не отправляется, под datetime picker появляется inline error «Укажите время в будущем» (FR6.4, UX-DR4)
**And** Toast не используется для ошибки валидации

**Given** автор ввёл валидное будущее время и нажимает «Сохранить»
**When** форма отправляется
**Then** пост сохраняется со `status='scheduled'` и `scheduled_at` в UTC (FR6.5)
**And** пост не отображается в ленте участников

**Given** автор открыл существующий `scheduled` пост для редактирования
**When** форма загружается
**Then** toggle установлен в «Запланировать», datetime picker показывает текущее `scheduled_at` в локальной timezone

**Given** автор изменил `scheduled_at` на новое валидное время и сохраняет
**When** форма отправляется
**Then** поле `scheduled_at` обновляется в БД (FR6.7)

**Given** автор переключает toggle обратно на «Опубликовать сейчас» и сохраняет
**When** форма отправляется
**Then** пост сохраняется со `status='draft'`, `scheduled_at=null` (FR6.8)

**Given** автор использует keyboard-only навигацию
**When** перемещается по форме
**Then** toggle и datetime picker полностью доступны с клавиатуры (WCAG 2.1 AA, UX-DR3)

### Story 6.4: Admin — Раздел «Запланировано» в admin-панели

As a автор,
I want видеть список всех запланированных постов и управлять ими прямо из admin-панели,
So that я могу контролировать расписание публикаций, не открывая каждый пост отдельно.

**Acceptance Criteria:**

**Given** автор открыл admin-панель
**When** переходит на страницу/вкладку «Запланировано»
**Then** отображается таблица со всеми постами `status='scheduled'`: заголовок поста, дата и время публикации в локальной timezone автора, статус
**And** посты отсортированы по `scheduled_at` по возрастанию (ближайшие — первые)

**Given** данные таблицы загружаются
**When** компонент таблицы находится в состоянии `isLoading=true`
**Then** отображается Skeleton с `animate-pulse`, повторяющий структуру строк таблицы (UX-DR6)

**Given** список запланированных постов пуст
**When** таблица полностью загружена
**Then** отображается Empty State с текстом «Нет запланированных постов»

**Given** таблица отображается на узком экране (мобайл)
**When** ширины экрана недостаточно для всех колонок
**Then** таблица получает горизонтальный скролл через `overflow-x-auto` (UX-DR8)

**Given** автор видит строку с запланированным постом
**When** нажимает кнопку редактирования (иконка или «Редактировать»)
**Then** переходит к форме редактирования поста с toggle, уже установленным в «Запланировать» (FR6.15)

**Given** автор нажимает «Отменить публикацию» в строке
**When** запрос на обновление выполняется успешно
**Then** `status` поста меняется на `draft`, `scheduled_at=null`, строка исчезает из таблицы (FR6.16, FR6.8)
**And** кнопка «Отменить публикацию» использует цвет `--destructive` из design system (UX-DR9)

**Given** при отмене публикации произошла ошибка сервера
**When** запрос завершился с ошибкой
**Then** отображается Toast с сообщением об ошибке, состояние таблицы не изменяется (UX-DR5)

**Given** компонент таблицы реализован по паттерну Smart Container / Dumb UI
**When** разработчик инспектирует код
**Then** `ScheduledPostsTable` (Dumb UI) принимает `posts`, `isLoading`, `onCancel`, `onEdit`, `onPublishNow` через props и не импортирует Supabase напрямую
**And** `ScheduledPostsContainer` (Smart) подписывается на данные и передаёт их в таблицу

**Given** автор видит строку с запланированным постом
**When** нажимает кнопку «Опубликовать сейчас»
**Then** `status` поста меняется на `published`, `published_at=now()`, запускается стандартная email-рассылка участникам (FR6.9)
**And** строка исчезает из таблицы «Запланировано»
**And** при ошибке — отображается Toast с сообщением об ошибке, состояние таблицы не изменяется

---

## Epic 7: Rich Content Experience (WYSIWYG HTML Content & Inline Media)

Автор создаёт посты с форматированным rich-text article body и встроенными инлайн-изображениями через WYSIWYG-редактор; участницы видят корректно скомпонованный контент с sanitize + HTML render path, lazy loading изображений и правильным комбинированным layout (article body + галерея).

**FRs covered:** FR19.1, FR16.2, NFR4.2
**Stories:** 7.1 (WYSIWYG Editor) → 7.2 (HTML Renderer & Combined Layout)
**Зависимости:** после Epic 4 (форма создания поста существует, поле `content` в таблице `posts`)

---

### Story 7.1: WYSIWYG-редактор для инлайн-изображений в постах (FR19.1)

As a автор,
I want загружать изображения прямо в тело текста поста через редактор,
So that я могла создавать богатый rich-text контент с инлайн-иллюстрациями без ручного копирования ссылок.

**Acceptance Criteria:**

**Given** автор открыл форму создания или редактирования поста
**When** просматривает текстовое поле
**Then** вместо обычного `<textarea>` отображается WYSIWYG-редактор на базе Tiptap (`'use client'` компонент в `src/features/editor/components/TiptapEditor.tsx`)
**And** редактор поддерживает базовое форматирование: жирный, курсив, заголовки (H2–H4), списки, блок кода
**And** редактор отображает сериализованный HTML-контент существующего поста при редактировании

**Given** автор перетаскивает (drag & drop) изображение в область редактора
**When** файл отпускается
**Then** изображение загружается в Supabase Storage bucket `inline-images` (не в `gallery-media`)
**And** во время загрузки в месте вставки отображается inline-индикатор загрузки
**And** после успешной загрузки в тело поста автоматически вставляется `![имя файла](public_url)` в позицию курсора

**Given** автор вставляет (paste) изображение из буфера обмена в редактор
**When** срабатывает событие paste
**Then** изображение загружается в bucket `inline-images` с тем же флоу, что и drag & drop
**And** URL автоматически вставляется в контент в виде Markdown-изображения

**Given** загрузка изображения завершилась ошибкой (сеть, превышение размера, неверный формат)
**When** upload API возвращает ошибку
**Then** placeholder удаляется из редактора
**And** отображается Toast с описанием ошибки («Файл слишком большой. Максимум 10 МБ» / «Неверный формат. Разрешены: JPG, PNG, WebP»)
**And** курсор возвращается в позицию до попытки вставки

**Given** автор завершил редактирование и нажимает «Сохранить» / «Опубликовать»
**When** форма отправляется
**Then** редактор сериализует содержимое в Markdown-строку и передаёт в поле `content` таблицы `posts`
**And** загруженные инлайн-изображения в bucket `inline-images` сохраняются (orphaned-очистка — вне этой истории)

**Given** компонент `TiptapEditor` реализован
**When** разработчик инспектирует код
**Then** `TiptapEditor` находится в `src/features/editor/components/`
**And** кастомное Tiptap-расширение для загрузки изображений — в `src/features/editor/extensions/ImageUpload.ts`
**And** upload-хелпер — в `src/features/editor/lib/uploadInlineImage.ts`, использует `supabase.storage.from('inline-images').upload(...)`
**And** `TiptapEditor` принимает `value: string` (начальный Markdown) и `onChange: (markdown: string) => void` через props — не импортирует Zustand store напрямую

**Given** автор использует keyboard-only навигацию
**When** перемещается по редактору
**Then** Tiptap-редактор полностью доступен с клавиатуры (WCAG 2.1 AA)
**And** область редактора имеет `aria-label="Текст поста"` и `role="textbox"`

**FRs covered:** FR19.1

---

### Story 7.2: HTML-рендеринг rich-content постов с инлайн-изображениями и комбинированным layout (FR16.2, NFR4.2)

As a участница,
I want видеть посты с форматированным текстом, встроенными изображениями и галереей в правильной компоновке,
So that я могла удобно читать богатый контент без визуальных артефактов.

**Acceptance Criteria:**

**Given** пост содержит только HTML article body в `posts.content` (без галереи)
**When** участница открывает страницу поста
**Then** компонент `MarkdownRenderer` рендерит форматированный article body (заголовки, списки, жирный, курсив, блоки кода)
**And** все `<img>` внутри HTML article body имеют атрибут `loading="lazy"` (NFR4.2)
**And** проверка lazy loading подтверждается через Lighthouse audit (не блокирует LCP)

**Given** пост содержит HTML article body со встроенными инлайн-изображениями (`<figure data-type="inline-image">`)
**When** участница открывает страницу поста
**Then** инлайн-изображения отображаются внутри текстового блока в правильном месте согласно разметке
**And** каждое инлайн-изображение имеет `loading="lazy"` и `alt`-атрибут из HTML-разметки article body (NFR16)
**And** изображения адаптивны: `max-width: 100%`, не выходят за ширину контентного блока

**Given** пост содержит и HTML article body с инлайн-изображениями, и галерею (`post_media` с 2+ записями)
**When** участница открывает страницу поста
**Then** блок `MarkdownRenderer` (текст + инлайн-изображения) отображается **ниже** блока `GalleryGrid`
**And** между двумя блоками есть визуальный разделитель (отступ `gap` согласно design tokens)
**And** компонент `PostDetail` (Dumb UI) принимает отдельные пропы: `content: string` (HTML article body) и `media: PostMedia[]` (для галереи) — рендерит их независимо

**Given** HTML article body поста содержит потенциально опасный HTML
**When** `MarkdownRenderer` парсит и рендерит контент
**Then** HTML санитизируется через DOMPurify до рендеринга (защита от XSS)
**And** разрешены только безопасные теги: `p`, `strong`, `em`, `ul`, `ol`, `li`, `h2`–`h4`, `img`, `code`, `pre`, `blockquote`

**Given** компонент `MarkdownRenderer` реализован
**When** разработчик инспектирует код
**Then** `MarkdownRenderer` — Dumb UI компонент в `src/features/feed/components/`, принимает `content: string` через props, не импортирует Supabase напрямую
**And** использует sanitize + `dangerouslySetInnerHTML` render path для HTML article body
**And** компонент покрыт unit-тестом: рендеринг заголовков, списков, инлайн-изображений с `loading="lazy"`
**And** sanitization utilities вынесены в `src/lib/markdown.ts`

**FRs covered:** FR16.2, NFR4.2

---

## Epic 8: Video Thumbnails — Avtomatska in ročna upravljanje posterjev za video

Автор получает автоматическое и ручное управление poster-изображениями для видео; детали требований, Acceptance Criteria и NFR находятся в `prd-video-thumbnails.md`.

**FRs covered:** FR8.1–FR8.7
**NFRs covered:** NFR8.1–NFR8.6
**Зависимости:** после Epic 2 и Story 4.1.

### Story 8.1: Автоматическая генерация thumbnail'а при сохранении объекта

Автор получает автоматически созданный poster из первого кадра видео без блокировки сохранения объекта.

**Canonical acceptance criteria:** `prd-video-thumbnails.md`, Story 8.1.

### Story 8.2: Ручная замена poster'а в редакторе

Автор может загрузить, заменить или удалить poster конкретного видео в редакторе.

**Canonical acceptance criteria:** `prd-video-thumbnails.md`, Story 8.2.

### Story 8.3: Ретроактивная генерация thumbnail'ов для существующих объектов

Администратор запускает идемпотентную массовую обработку видео без `thumbnail_url` и получает отчёт.

**Canonical acceptance criteria:** `prd-video-thumbnails.md`, Story 8.3.

### Story 8.4: Повторная генерация и удаление thumbnail'а

Автор повторно создаёт poster или удаляет его с корректным fallback в ленте.

**Canonical acceptance criteria:** `prd-video-thumbnails.md`, Story 8.4.

---

## Epic 9: Временное предложение и ограниченный по сроку разовый доступ

Новая или бывшая участница без действующей recurring-подписки может один раз оплатить €29,00 и безопасно получить доступ к существующей базе на три календарных месяца. Действующие подписчицы сохраняют текущий subscription lifecycle, а после cutoff автоматически возвращается исходная recurring-модель без сокращения ранее выданного временного доступа.

**FRs covered:** FR1.4, FR1.4.1, FR1.4.2, FR1.4.3, FR3.1, FR5.1, FR8 (temporary branch), FR27 (temporary branch)
**Stories:** 9.1 (Time-limited Entitlement & Unified Access) → 9.2 (One-Time Purchase & Activation) → 9.3 (Safe Rollback & Exceptions)
**Зависимости:** после Epic 1 и Epic 3; existing recurring checkout, authentication, protected content и email pipeline уже существуют

---

### Story 9.1: Ограниченный entitlement и единый контроль доступа

As a участница с подтверждённым временным правом доступа,
I want получать одинаковый доступ ко всему закрытому контенту до точного `access_ends_at`,
So that мой доступ не зависит от recurring subscription и корректно прекращается через три календарных месяца.

**Acceptance Criteria:**

1. **Entitlement ledger**

   **Given** применяется migration
   **When** создаются `payment_fulfillment_attempts` и `access_entitlements`
   **Then** append-only attempt содержит unique `stripe_checkout_session_id`, nullable unique `stripe_payment_intent_id`, Stripe event и immutable payment/offer attribution, необходимые для service-role fixture и будущего fulfillment
   **And** entitlement содержит `id`, nullable `user_id`, `source`, `status`, `offer_code`, `offer_version`, unique `fulfillment_attempt_id` с FK на attempt, `purchaser_email_normalized`, `paid_at`, `access_starts_at`, `access_ends_at`, nullable `claimed_at`, nullable `revoked_at` и `created_at`
   **And** lifecycle ограничен переходом `unclaimed → claimed`; expiry вычисляется по времени, а не записывается cron-задачей.

2. **Уникальность grant**

   **Given** для одного email уже существует entitlement данного `offer_code`
   **When** trusted service пытается создать второй grant
   **Then** constraint `(offer_code, purchaser_email_normalized)` предотвращает дублирование
   **And** существующий `access_ends_at` не изменяется и не продлевается.

3. **Calendar expiry**

   **Given** entitlement создаётся с известным `paid_at`
   **When** рассчитывается срок доступа
   **Then** `access_starts_at = paid_at`
   **And** `access_ends_at` один раз вычисляется в PostgreSQL как три календарных месяца в `Europe/Ljubljana` и сохраняется как `timestamptz`
   **And** расчёт не зависит от session `TimeZone` и не использует 90 дней
   **And** при `evaluated_at == access_ends_at` доступ отсутствует.

4. **Atomic verified-email claim**

   **Given** существует webhook-compatible `unclaimed` entitlement
   **When** authenticated пользовательница вызывает claim
   **Then** server-side функция связывает его с `auth.uid()` только при точном совпадении `lower(btrim(auth.users.email))` и `purchaser_email_normalized`
   **And** provider aliasing не применяется
   **And** один entitlement нельзя связать с двумя пользователями
   **And** повторный вызов тем же пользователем идемпотентен.

5. **Canonical access resolver**

   **Given** системе переданы `user_id` и `evaluated_at`
   **When** private DB resolver вычисляет доступ
   **Then** он учитывает источники `admin`, `vip`, `recurring` и `temporary_one_time`
   **And** возвращает `has_access`, уникальный `sources[]` в canonical order, `valid_until` и `evaluated_at`
   **And** при `has_access=false` возвращает `valid_until=evaluated_at`
   **And** при наличии active admin/VIP/recurring source возвращает `valid_until=NULL`, а при доступе только через time-limited grants — максимальный active `access_ends_at`
   **And** active temporary source требует `status='claimed'`, non-null `user_id/claimed_at`, `revoked_at IS NULL` и полуинтервал `[access_starts_at, access_ends_at)`.

6. **Ограниченные RPC wrappers**

   **Given** authenticated пользовательница проверяет собственный доступ
   **When** вызывается public wrapper
   **Then** `has_current_content_access()` и `get_my_content_access_state()` используют `auth.uid()` и private resolver
   **And** не принимают произвольный `user_id`
   **And** private functions используют schema-qualified names и `search_path=''`
   **And** `EXECUTE` выдан только необходимым ролям.

7. **RLS и защищённые поверхности**

   **Given** пользовательница обращается к закрытому контенту
   **When** выполняется read или mutation
   **Then** posts, post media, comments, likes, content RPC и protected Storage objects применяют canonical access predicate
   **And** expired entitlement одинаково запрещается во всех этих точках
   **And** anonymous preview policies не раскрывают protected body, media, comments или authorization/payment fields.

8. **Middleware parity и cache deadline**

   **Given** middleware получает access state через authenticated RPC
   **When** создаётся signed HttpOnly cache token
   **Then** token привязан к `user_id` и содержит canonical `sources` и `valid_until_epoch`
   **And** его lifetime равен `min(configured_ttl, valid_until - now)`
   **And** достигнутый entitlement deadline делает token недействительным независимо от cookie expiry
   **And** admin/VIP/recurring сохраняют существующий короткий TTL и revocation SLA.

9. **Email recipient parity**

   **Given** формируется рассылка нового опубликованного поста
   **When** service-role recipient RPC вычисляет аудиторию
   **Then** claimed active temporary entitlement включается наравне с recurring access
   **And** дополнительно применяются `email_notifications_enabled` и существующая audience policy
   **And** expired entitlement исключается
   **And** admin/VIP не включаются только на основании доступа
   **And** расширение recipient selection сохраняет доставку в течение 5 минут и delivery rate ≥ 95%.

10. **Trusted mutation boundary**

    **Given** запрос выполняется от `anon` или `authenticated`
    **When** он пытается изменить entitlement либо `role`, `is_vip`, `subscription_status` и Stripe-поля profile
    **Then** операция запрещается RLS и column/table grants
    **And** entitlement DML доступен только trusted server/service-role path
    **And** runtime DELETE grant отсутствует.

11. **Regression и независимая проверяемость**

    **Given** Story 9.1 реализована без checkout из Story 9.2
    **When** тест создаёт entitlement через контролируемый service-role fixture и выполняет verified claim
    **Then** middleware, RLS, Storage и email дают согласованный доступ до deadline и запрещают его на точной правой границе
    **And** тесты покрывают DST, даты 29/30/31 числа, повторный claim и параллельную попытку второго grant
    **And** доступ существующих admin, VIP, `active` и `trialing` пользователей остаётся неизменным.

**FRs covered:** FR1.4.2, FR3.1, FR27 (temporary branch)

---

### Story 9.2: Разовая покупка €29 и активация доступа

As a новая или бывшая участница без действующей recurring-подписки,
I want один раз оплатить €29,00 и активировать доступ через подтверждённый email,
So that я получаю три месяца доступа без подписки и автопродления.

**Acceptance Criteria:**

1. **TemporaryOfferConfig**

   **Given** приложение запускается в `test` или `live` environment
   **When** загружается server-only конфигурация предложения
   **Then** она содержит start/end/timezone, offer code/version, exact Payment Link и Price IDs, URL, amount, currency, quantity и metadata
   **And** missing, mixed или environment-mismatched значения fail closed отключают temporary UI, redirect и fulfillment.

2. **Server-derived offer mode**

   **Given** server time находится внутри canonical offer window
   **When** рендерится landing pricing
   **Then** UI получает temporary mode только от сервера
   **And** client time, stale tab или cached JavaScript не могут самостоятельно открыть temporary checkout
   **And** вне окна отображается исходная recurring-модель.

3. **Purchase eligibility**

   **Given** authenticated пользовательница имеет `active`/`trialing` subscription либо существующий grant данного `offer_code`
   **When** она запрашивает temporary Link
   **Then** redirect gate возвращает отказ без раскрытия Link URL
   **And** бывшая подписчица без активного recurring-доступа допускается
   **And** VIP/admin исключаются fail closed до утверждения отдельной policy.

4. **Pricing UI**

   **Given** temporary mode активен
   **When** посетительница видит PricingSection
   **Then** показана одна карточка с `€29,00 / 3 mesece`, семантически зачёркнутой `€34,00` и строкой `Dostop do obstoječe baze znanja za 3 mesece.`
   **And** отсутствуют radiogroup, plan selector, `MESEČNO`, `€12,99`, `/ mesec`, `≈`, `Prihranek`, cancellation/autorenewal copy и обещание новых материалов `3-4x na teden`.

5. **Accessible CTA**

   **Given** eligible посетительница использует временную карточку
   **When** активирует CTA
   **Then** доступное имя равно `Pridruži se zdaj`
   **And** повторное нажатие блокируется до ответа redirect gate
   **And** network/redirect failure показывает понятное словенское сообщение через существующий error pattern, не выполняет автоматический retry и не инициирует второй переход или оплату
   **And** keyboard focus видим, touch target не меньше 44×44 px и состояния не зависят только от цвета
   **And** на 375px, 768px и ≥1024px отсутствует горизонтальное переполнение.

6. **Stripe Payment Link contract**

   **Given** redirect gate разрешил покупку
   **When** пользовательница переходит в Stripe
   **Then** используется exact allowlisted Payment Link с `mode='payment'`, одним item €29.00 EUR и quantity 1
   **And** присутствуют утверждённые `offer_code`, `offer_version` и `access_months`
   **And** отсутствуют recurring Price, subscription, trial и auto-renewal.

7. **Signed webhook validation**

   **Given** Stripe отправляет checkout event
   **When** webhook начинает обработку
   **Then** signature проверяется на raw body до разбора payload
   **And** Checkout Session повторно загружается server-side с expanded `line_items`
   **And** проверяются exact Link, Price, metadata, amount, currency, quantity, `mode='payment'` и paid status
   **And** webhook snapshot или metadata без server-side retrieval недостаточны для выдачи доступа.

8. **Immediate и delayed payment**

   **Given** вызывается общий `fulfillTemporaryOffer(sessionId)`
   **When** получен `checkout.session.completed`
   **Then** fulfillment выполняется только при `payment_status='paid'`
   **And** delayed payment получает тот же fulfillment через `checkout.session.async_payment_succeeded`
   **And** `paid_at` равен `event.created` первого qualifying paid event: paid completed-event для immediate payment либо async success для delayed payment; receipt order и retry не меняют timestamp
   **And** unpaid, failed или неизвестный one-time payment не создаёт entitlement.

9. **Append-only payment attempt**

   **Given** Session прошла payment validation
   **When** фиксируется результат fulfillment
   **Then** в созданной Story 9.1 таблице фиксируется immutable attempt с unique Checkout Session ID, nullable unique PaymentIntent ID, Stripe event, allowlist attribution, canonical purchaser email, amount/currency и `paid_at`
   **And** authoritative email берётся только из retrieved `customer_details.email` и нормализуется через `lower(btrim(...))`
   **And** отсутствие email создаёт non-granting exception.

10. **Idempotent grant transaction**

    **Given** qualifying paid Session обрабатывается впервые или повторно
    **When** transaction фиксирует attempt и пытается создать entitlement
    **Then** первый успешный insert создаёт ровно один `unclaimed` grant
    **And** retry или параллельная доставка той же Session становится no-op
    **And** существующие `paid_at` и `access_ends_at` не изменяются
    **And** distinct duplicate Session не заменяет первый grant и получает review disposition.

11. **Post-payment claim UX**

    **Given** Stripe возвращает покупательницу с `{CHECKOUT_SESSION_ID}`
    **When** она проходит существующий register/verification либо authenticated login return
    **Then** вызывается claim contract из Story 9.1
    **And** совпавший verified email активирует entitlement и открывает onboarding
    **And** если webhook ещё не доставлен, UI показывает словенский pending state и безопасно повторяет claim
    **And** success/onboarding state показывает индивидуальную дату окончания доступа и прямо сообщает об отсутствии автопродления
    **And** redirect/session ID никогда не создаёт entitlement и не заменяет проверку email.

12. **Recurring regression**

    **Given** temporary checkout и webhook завершены
    **When** сравниваются recurring данные до и после
    **Then** `/api/checkout` продолжает принимать `monthly|quarterly` для rollback
    **And** неизменны recurring Price IDs, Stripe customer/subscription IDs, `subscription_status`, `current_period_end`, billing interval и `cancel_at_period_end`
    **And** one-time handler не создаёт, не обновляет и не отменяет Stripe Subscription.

13. **Verification**

    **Given** Story 9.2 готова
    **When** выполняются automated и Stripe test-mode проверки
    **Then** покрыты обе временные границы, eligibility, invalid config/signature/link/price/mode/status, immediate и delayed payment, duplicate delivery, pending claim и email mismatch
    **And** проходят accessibility/responsive проверки temporary pricing
    **And** существующие recurring checkout и subscription webhook suites остаются зелёными.

**FRs covered:** FR1.4, FR1.4.1, FR1.4.3, FR8 (temporary branch)

---

### Story 9.3: Безопасное завершение предложения и обработка исключений

As a владелица PROCONTENT,
I want контролируемо завершить временное предложение и обработать ошибочные платежи,
So that recurring-модель возвращается без повреждения действующих подписок и уже выданного доступа.

**Acceptance Criteria:**

1. **Automatic cutoff**

   **Given** наступает `2026-12-01 00:00:00+01:00`
   **When** server-derived commercial mode вычисляется после cutoff
   **Then** temporary pricing и Link redirect отключаются независимо от client cache
   **And** лендинг возвращает исходные €12,99/месяц и €34/3 месяца, plan selector и recurring checkout copy
   **And** `/api/checkout` снова является публичным purchase path.

2. **Payment Link deactivation**

   **Given** наступил cutoff
   **When** назначенный operator выполняет rollback runbook
   **Then** деактивируется exact allowlisted live Payment Link
   **And** сохраняются Link ID, timestamp, Stripe evidence и результат проверки недоступности Link
   **And** при ошибке Stripe operation app redirect gate остаётся fail closed и запускается escalation.

3. **Сохранение выданного доступа**

   **Given** entitlement был создан до окончания предложения
   **When** temporary UI и Payment Link отключаются
   **Then** claimed entitlement продолжает действовать до индивидуального `access_ends_at`
   **And** не удаляется, не сокращается и не конвертируется в subscription
   **And** после deadline canonical resolver прекращает доступ обычным способом.

4. **Late webhook semantics**

   **Given** qualifying Stripe event доставлен после cutoff
   **When** fulfillment проверяет immutable `paid_at`
   **Then** grant может быть завершён только если qualifying paid event возник внутри offer window
   **And** retry ранее принятого события остаётся идемпотентным
   **And** новый async success с `event.created` после cutoff не создаёт grant и переходит в exception flow.

5. **Business exception classification**

   **Given** оплаченная Session является duplicate, ineligible или out-of-window
   **When** fulfillment завершает проверку
   **Then** entitlement не создаётся
   **And** attempt получает immutable disposition `duplicate_review` либо `ineligible_review`
   **And** сохраняется безопасный reconciliation context без секретов и полных платёжных данных.

6. **Refund case lifecycle**

   **Given** exception требует возврата
   **When** создаётся `payment_refund_cases`
   **Then** запись имеет unique `fulfillment_attempt_id` и lifecycle `refund_pending → refunded | refund_failed_manual`
   **And** refund state не изменяет append-only attempt или entitlement
   **And** Stripe refund использует idempotency key, производный от Checkout Session ID
   **And** retry не создаёт повторный refund.

7. **Approved refund policy**

   **Given** automatic или manual refund executor ещё не утверждён
   **When** проверяется production readiness
   **Then** temporary offer не может быть включён в production
   **And** Owner/PM должны утвердить executor, SLA, customer communication и support ownership
   **And** каждый `refund_pending` и `refund_failed_manual` доступен в reconciliation workflow.

8. **Observability и automatic containment**

   **Given** fulfillment, resolver или RLS работает некорректно
   **When** обнаружен controlled-event 5xx, access-state mismatch либо production refund failure
   **Then** создаётся alert с безопасными event/session identifiers
   **And** temporary redirect gate автоматически закрывается
   **And** recurring access и ранее claimed entitlements не отключаются.

9. **Existing subscriber protection**

   **Given** выполняется launch или rollback
   **When** сравниваются зафиксированные sample subscriptions
   **Then** неизменны customer/subscription IDs, Price, billing interval, `subscription_status`, `current_period_end` и `cancel_at_period_end`
   **And** ни один temporary handler или runbook step не изменяет и не отменяет существующую subscription.

10. **Expired и inactive UX**

    **Given** temporary entitlement истёк
    **When** пользовательница открывает закрытую поверхность
    **Then** она получает понятное словенское сообщение об окончании доступа
    **And** видит только актуальную коммерческую модель
    **And** сообщение объясняет отсутствие автопродления и не утверждает, что subscription была отменена
    **And** keyboard, focus, contrast и responsive требования сохраняются.

11. **Launch approvals**

    **Given** команда готовит production enablement
    **When** проводится go/no-go review
    **Then** утверждены exact live Link/Price/config, schema и migration, RLS/GRANT matrix, VIP/admin eligibility, словенский copy, refund policy, GDPR retention/redaction и rollback operator
    **And** test и live identifiers разделены
    **And** секреты и Payment Link URL остаются server-only там, где это предусмотрено contract.

12. **Launch verification**

    **Given** approvals получены
    **When** выполняется controlled launch test
    **Then** подтверждён полный путь payment → attempt → entitlement → verified claim → middleware/RLS/email
    **And** проверены invalid signature/config, duplicate delivery, delayed payment, email mismatch, exact expiry и exception/refund states
    **And** recurring regression suites остаются зелёными.

13. **Rollback rehearsal**

    **Given** предложение ещё не включено в production
    **When** команда репетирует rollback
    **Then** подтверждены автоматическое переключение UI, блокировка redirect, процедура деактивации Link, smoke test recurring checkout и сохранение active entitlements
    **And** runbook содержит accountable Owner, responsible operator, DEV escalation и fallback при ошибке.

14. **Dependency security gate**

    **Given** проект использует уязвимую или неподдерживаемую версию Next.js
    **When** оценивается readiness к launch
    **Then** dependency обновляется до актуальной patched версии согласно official advisories на момент реализации
    **And** после обновления повторно выполняются build, typecheck, lint и relevant regression suites.

**FRs covered:** FR5.1; operational completion FR1.4, FR3.1 и FR8
