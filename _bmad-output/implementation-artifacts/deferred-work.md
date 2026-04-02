# Deferred Work

## Deferred from: code review of 6-2-pg-cron-automatic-publishing-of-scheduled-posts (2026-04-02)

- **Race condition при параллельных cron-вызовах** — теоретически возможен duplicate-email при одновременном запуске двух cron-триггеров. PostgreSQL UPDATE с WHERE условием атомарен, но при одновременном чтении двух экземпляров cron оба могут захватить одни и те же строки. Для MVP с pg_cron каждые 5 минут вероятность крайне мала. При масштабировании рассмотреть `SELECT FOR UPDATE SKIP LOCKED` через RPC.

## Deferred from: code review of 6-2-pg-cron-automatic-publishing-of-scheduled-posts Round 3 (2026-04-02)

- **`response.body?.cancel()` без таймаута** — теоретически может заблокировать весь for-цикл уведомлений если notification endpoint отдаёт потоковый или медленный ответ. AbortController уже деактивирован к этому моменту. Для MVP с маленькими JSON-ответами риск пренебрежимо мал. При работе с ненадёжными upstream сервисами рассмотреть `Promise.race([body.cancel(), timeout])`.
- **HTTP 200 при отсутствующих env vars** — cron-планировщик видит success, оператор не получает alerting-сигнала о misconfigured deployment. Намеренное дизайн-решение: publication важнее notification. При необходимости операционного alerting рассмотреть отдельный health-check endpoint.
- **Race condition при параллельных cron-вызовах (Round 3)** — crash в середине email-цикла ведёт к недоставленным уведомлениям без возможности retry (посты уже опубликованы). Для полной надёжности нужна таблица `notification_log` с отслеживанием статуса отправки.
- **`post.title` null/whitespace не валидируется** — whitespace-only title генерирует письма с пустым subject `"Nova objava: "`. Extreme edge case: title = required field в БД и в admin форме, поэтому через нормальный flow невозможно. Service role key обходит RLS, теоретически возможно через прямой SQL.



## Deferred from: code review of 6-1-post-status-model-database-schema (2026-04-02)

- **`is_published` и `status` — два независимых флага без DB-level enforcement constraint.** Нет CHECK или триггера, гарантирующего синхронность `is_published=true ↔ status='published'`. Структурный debt, требует отдельного рассмотрения при полном переходе на `status`.
- **`scheduled_at` не имеет CHECK `NOT NULL` при `status='scheduled'`.** Семантически пост `status='scheduled'` обязан иметь `scheduled_at IS NOT NULL`, но это не закреплено в схеме. Добавить в Story 6.2 при реализации cron-логики.
- **Partial index `idx_posts_scheduled` не охватывает `published_at`.** Будущие cron-запросы должны явно включать `AND status = 'scheduled'` в WHERE, иначе partial index не применится. Учесть при реализации Story 6.2.
- **`getPublishedTimestamp()` использует клиентское JS-время (`new Date().toISOString()`).** Клиентское время подвержено clock skew. Для точности следует использовать серверный `now()` через Server Action или DB default. Требует рефакторинга create flow.
- **Snapshot null check в `updatePost` при параллельном удалении поста.** Если пост удалён конкурентно во время редактирования, snapshot = null, rollback-блок пропускается, частично обновлённые поля остаются в БД. Pre-existing issue.
- **Частичный rollback `post_media` при сбое insert new media (step 5).** Rollback откатывает текстовые поля и `type`, но не восстанавливает upserted `order_index`/`is_cover` из step 4. Pre-existing issue.
