# Brief: Architect - Epic 7 Retro Follow-up

## Контекст

Epic 7 доставил working rich-content flow, но ретро показало два архитектурно значимых последствия:

1. Реальный rendering/storage contract отличается от части исходных planning формулировок.
2. Вокруг consumer-side HTML rendering остались целевые deferred вопросы, которые не критичны для shipped scope, но важны для устойчивости следующего цикла.

Речь не о redesign системы, а о точечном архитектурном закреплении уже принятых решений и подготовке минимального stabilization scope.

## Цель brief

Подготовить Architect к выработке компактного technical follow-up пакета после Epic 7: что нужно закрепить документально, что нужно выделить в stabilization, а что пока оставить как осознанный debt.

## Что нужно сделать Architect

### 1. Зафиксировать фактический technical contract

Нужно подтвердить и документально закрепить:

- `posts.content` хранит HTML output из Tiptap;
- inline images embedded в article body;
- `gallery-media` и `inline-images` — разные storage/payload домены;
- render path построен на DOMPurify + HTML render;
- это остаётся brownfield-safe расширением, а не основанием для rewrite admin/feed architecture.

### 2. Сформировать stabilization scope для rendering layer

На основе deferred findings по Story 7.2 Architect должен предложить минимально достаточный stabilization packet:

- performance strategy для sanitization/render path;
- решение по error containment для DOM-based rendering;
- критерии, когда эти вопросы считаются “достаточно закрытыми” для следующего большого epic.

Важно: это должен быть узкий и прагматичный scope, а не общий рефакторинг “rendering subsystem”.

### 3. Приоритизировать технические хвосты рядом с Epic 7

Architect должен оценить, какие debt items реально влияют на следующий цикл, а какие можно осознанно отложить.

Особенно посмотреть:

- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/tech-debt.md`

Нужно отделить:

- debt, связанный с rich-content/rendering;
- debt, который относится к adjacent systems (Stripe, scheduled publishing, search);
- debt, который не стоит смешивать в один stabilization batch.

### 4. Подготовить рекомендации для следующего цикла

Architect должен дать ответ на вопросы:

- достаточно ли project health для старта нового epic без stabilization;
- если stabilization нужен, какой его минимальный состав;
- какие документы/решения надо обновить до старта следующего engineering scope.

## Ключевые темы для архитектурного анализа

### Rendering Contract

- HTML как source of truth для article body;
- sanitize-before-render pipeline;
- требования к lazy-loading, XSS safety и predictable hydration behavior.

### Boundary Discipline

- сохранение разделения `gallery` и `editor`;
- отсутствие смешивания media-models в future stories;
- сохранение Smart/Dumb patterns и feature isolation.

### Stability / Maintainability

- стоимость DOM sanitization на повторных renders;
- нужна ли локальная стратегия memoization/caching;
- нужен ли Error Boundary или другой containment layer;
- как избежать повторного дрейфа между planning docs и implementation reality.

## Входные артефакты

- `_bmad-output/implementation-artifacts/Epic 7 Retro Follow-up/context-packet-epic-7-retro-follow-up.md`
- `_bmad-output/implementation-artifacts/epic-7-retro-2026-04-09.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/project-context.md`
- `_bmad-output/stories/7-1-wysiwyg-editor-inline-images-posts.md`
- `_bmad-output/stories/7-2-markdown-rendering-posts-inline-images-and-combined-layout.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/tech-debt.md`

## Что Architect не должен делать

- Не расширять scope до большого platform refactor.
- Не пытаться одним пакетом закрыть и Epic 7 follow-up, и Stripe debt, и scheduled publishing reliability.
- Не переопределять уже работающий product behavior без явного product input.

## Ожидаемый результат от Architect

- Короткое архитектурное заключение по фактическому contract Epic 7.
- Предложение по минимальному stabilization scope.
- Список архитектурных обновлений/решений, которые нужно закрепить до следующего engineering цикла.
