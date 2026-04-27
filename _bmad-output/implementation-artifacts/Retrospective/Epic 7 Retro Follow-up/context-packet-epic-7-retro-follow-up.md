# Context Packet: Epic 7 Retro Follow-up

## Назначение

Этот пакет нужен как единая точка входа для PM и Architect после завершения ретро по Epic 7. Он фиксирует текущее состояние, ключевые выводы ретро, список артефактов-источников и ожидаемый тип следующей работы.

## Текущий статус

- Epic 7 завершён и retrospective по нему закрыт.
- Retrospective сохранён в `_bmad-output/implementation-artifacts/epic-7-retro-2026-04-09.md`.
- `sprint-status.yaml` обновлён: `epic-7-retrospective: done`.
- Новый Epic 8 в planning artifacts не зафиксирован.

## Что доставил Epic 7

Epic 7 закрыл rich-content flow для постов:

- authoring через Tiptap/WYSIWYG;
- отдельный storage/pipeline для `inline-images`;
- безопасный render HTML-контента через DOMPurify;
- корректную композицию `gallery above text` в consumer-side view.

Ключевой продуктовый эффект: теперь admin может создавать richer article body, не смешивая inline media с gallery media.

## Главные выводы ретро

1. Epic 7 успешен по delivered scope и качеству реализации.
2. Основной риск не в feature gap, а в process discipline и управлении follow-up задачами.
3. Planning и implementation использовали неоднозначную терминологию: в артефактах встречается “Markdown”, тогда как фактический format contract после Story 7.1/7.2 — HTML output из Tiptap.
4. Deferred findings документируются, но не всегда превращаются в нормальный backlog с владельцем и приоритетом.

## Зафиксированные action items из ретро

### Для planning / PM

- Зафиксировать единый термин и format contract для `posts.content` как HTML Tiptap output.
- Синхронизировать PRD и связанные planning artifacts с фактической реализацией Epic 7.
- Решить, что идёт следующим: новый product scope или stabilization/cleanup batch.

### Для architecture / technical planning

- Выделить отдельный stabilization scope для `MarkdownRenderer`.
- Разобрать deferred findings по rendering/performance/error containment.
- Сформировать приоритетный tech-debt shortlist, который реально влияет на следующий цикл.

### Для процесса

- Ввести обязательный checklist закрытия story: sync story file, sprint-status, deferred findings, regression verification.
- Ввести правило: нет `done` без синхронизации артефактов.

## Важные входные артефакты

### Основные

- `_bmad-output/implementation-artifacts/epic-7-retro-2026-04-09.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/project-context.md`

### Story-level

- `_bmad-output/stories/7-1-wysiwyg-editor-inline-images-posts.md`
- `_bmad-output/stories/7-2-markdown-rendering-posts-inline-images-and-combined-layout.md`

### Follow-up / debt

- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/tech-debt.md`

## Что важно не потерять при передаче

- `posts.content` фактически хранит HTML, а не markdown string.
- `gallery` и `inline-images` — это разные домены и их нельзя снова смешивать ни в UI, ни в data model, ни в future stories.
- Epic 7 был сделан brownfield-safe; follow-up работа не должна превращаться в необоснованный rewrite.
- Если следующий шаг будет stabilization sprint, он должен быть маленьким, целевым и опираться на уже зафиксированные deferred findings, а не на абстрактное “почистить код”.

## Ожидаемый результат передачи

### PM

- Обновлённый planning narrative без терминологического дрейфа.
- Решение: новый scope vs stabilization-first.
- Нормализованный список product/planning follow-ups.

### Architect

- Ясный technical follow-up packet по rendering contract, performance, DOM safety и adjacent debt.
- Предложение по минимально достаточному stabilization scope.
- Список архитектурных обновлений, которые надо закрепить документально до следующего цикла.
