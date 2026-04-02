# Deferred Work

## Deferred from: code review of 6-2-pg-cron-automatic-publishing-of-scheduled-posts (2026-04-02)

- **Race condition при параллельных cron-вызовах** — теоретически возможен duplicate-email при одновременном запуске двух cron-триггеров. PostgreSQL UPDATE с WHERE условием атомарен, но при одновременном чтении двух экземпляров cron оба могут захватить одни и те же строки. Для MVP с pg_cron каждые 5 минут вероятность крайне мала. При масштабировании рассмотреть `SELECT FOR UPDATE SKIP LOCKED` через RPC.



## Deferred from: code review of 6-1-post-status-model-database-schema (2026-04-02)

- **`is_published` и `status` — два независимых флага без DB-level enforcement constraint.** Нет CHECK или триггера, гарантирующего синхронность `is_published=true ↔ status='published'`. Структурный debt, требует отдельного рассмотрения при полном переходе на `status`.
- **`scheduled_at` не имеет CHECK `NOT NULL` при `status='scheduled'`.** Семантически пост `status='scheduled'` обязан иметь `scheduled_at IS NOT NULL`, но это не закреплено в схеме. Добавить в Story 6.2 при реализации cron-логики.
- **Partial index `idx_posts_scheduled` не охватывает `published_at`.** Будущие cron-запросы должны явно включать `AND status = 'scheduled'` в WHERE, иначе partial index не применится. Учесть при реализации Story 6.2.
- **`getPublishedTimestamp()` использует клиентское JS-время (`new Date().toISOString()`).** Клиентское время подвержено clock skew. Для точности следует использовать серверный `now()` через Server Action или DB default. Требует рефакторинга create flow.
- **Snapshot null check в `updatePost` при параллельном удалении поста.** Если пост удалён конкурентно во время редактирования, snapshot = null, rollback-блок пропускается, частично обновлённые поля остаются в БД. Pre-existing issue.
- **Частичный rollback `post_media` при сбое insert new media (step 5).** Rollback откатывает текстовые поля и `type`, но не восстанавливает upserted `order_index`/`is_cover` из step 4. Pre-existing issue.
