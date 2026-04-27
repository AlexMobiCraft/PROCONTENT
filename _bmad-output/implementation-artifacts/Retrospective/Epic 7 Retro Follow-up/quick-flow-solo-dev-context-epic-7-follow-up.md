# Context Packet: Quick Flow Solo Dev - Epic 7 Follow-up

## Назначение

Этот пакет подготовлен специально для агента `bmad-agent-quick-flow-solo-dev` после завершения Epic 7 и retrospective.

Цель пакета:

- быстро ввести агента в контекст без повторного discovery;
- не допустить повторной реализации уже завершённого scope;
- дать чёткую рамку, какие follow-up действия допустимы;
- подготовить его либо к lean tech spec, либо к точечной реализации, если пользователь решит двигаться дальше.

## Статус на входе

- Epic 7 завершён.
- Retrospective по Epic 7 завершён.
- `sprint-status.yaml` уже обновлён: `epic-7-retrospective: done`.
- Новый Epic 8 не оформлен.

Это значит:

- agent не должен трактовать ситуацию как “нужно доделать Epic 7”;
- agent должен трактовать ситуацию как “нужно помочь с follow-up после Epic 7, если пользователь этого захочет”.

## Что уже сделано в Epic 7

Epic 7 закрыл rich-content flow:

- authoring через Tiptap/WYSIWYG;
- отдельный bucket/pipeline для `inline-images`;
- безопасный render HTML-контента через DOMPurify;
- корректную композицию `gallery above text`;
- regression/tests по authoring и render path.

## Ключевой фактический contract

Это самая важная часть контекста.

- `posts.content` фактически хранит HTML output из Tiptap.
- Это не markdown string как source of truth.
- `gallery` и `inline-images` — разные домены:
  - разные storage concerns;
  - разные payload concerns;
  - разный lifecycle;
  - не должны смешиваться снова.
- `MarkdownRenderer` по факту работает как HTML sanitizer/renderer для article body.

## Главные выводы ретро

1. Epic 7 успешен по delivered scope.
2. Основной риск не в недостающей функциональности, а в дрейфе contract между planning и implementation.
3. Deferred findings есть, но они не оформлены как нормальный исполнимый backlog.
4. Следующее логичное направление — `stabilization-first`, если пользователь действительно хочет выполнять follow-up работу.

## Что агент НЕ должен делать

- Не переписывать Epic 7 заново.
- Не открывать новый большой scope без явного запроса пользователя.
- Не смешивать follow-up по rich-content с большим общесистемным рефакторингом.
- Не тащить в один scope:
  - Stripe debt;
  - scheduled publishing debt;
  - search debt;
  - renderer follow-up.
- Не изобретать greenfield solution поверх уже работающего brownfield flow.

## Что агент МОЖЕТ делать

Если пользователь попросит продолжить работу, допустимы только эти типы next step:

### 1. Lean spec

Подготовить маленький technical follow-up/spec на stabilization `MarkdownRenderer`:

- performance sanitization;
- error containment для DOM rendering;
- сохранение текущего product behavior;
- без расползания в rewrite.

### 2. Точечная реализация

Если пользователь прямо скажет “делай”, агент может сразу перейти в quick-dev режим и выполнить:

- документарную синхронизацию contract;
- или узкий technical patch/scope вокруг renderer layer.

### 3. Backlog normalization

Если пользователь захочет, агент может преобразовать deferred findings в lean executable backlog:

- что реально делать сейчас;
- что отложить;
- что не смешивать в один batch.

## Самые важные follow-up пункты

### Planning / docs

- Зафиксировать `posts.content` как HTML Tiptap output.
- Убрать двусмысленность “Markdown vs HTML” из planning artifacts.

### Technical

- Разобрать deferred items по `MarkdownRenderer`:
  - heavy sanitization cost;
  - отсутствие error containment / Error Boundary strategy.

### Process

- Ввести close-out checklist:
  - sync story file;
  - sync sprint-status;
  - deferred findings;
  - regression verification.

## Источники, которые агент должен считать базовыми

- `C:/Users/1/DEV/PROCONTENT/_bmad-output/implementation-artifacts/epic-7-retro-2026-04-09.md`
- `C:/Users/1/DEV/PROCONTENT/_bmad-output/implementation-artifacts/sprint-status.yaml`
- `C:/Users/1/DEV/PROCONTENT/_bmad-output/implementation-artifacts/deferred-work.md`
- `C:/Users/1/DEV/PROCONTENT/_bmad-output/implementation-artifacts/tech-debt.md`
- `C:/Users/1/DEV/PROCONTENT/_bmad-output/planning-artifacts/prd.md`
- `C:/Users/1/DEV/PROCONTENT/_bmad-output/planning-artifacts/architecture.md`
- `C:/Users/1/DEV/PROCONTENT/_bmad-output/planning-artifacts/epics.md`
- `C:/Users/1/DEV/PROCONTENT/_bmad-output/stories/7-1-wysiwyg-editor-inline-images-posts.md`
- `C:/Users/1/DEV/PROCONTENT/_bmad-output/stories/7-2-markdown-rendering-posts-inline-images-and-combined-layout.md`
- `C:/Users/1/DEV/PROCONTENT/_bmad-output/project-context.md`

## Рекомендуемая рабочая позиция агента

Если пользователь не просит конкретную реализацию, агент должен исходить из этой логики:

1. Не “что ещё не сделано в Epic 7?”
2. А “какой минимальный follow-up действительно имеет смысл после Epic 7?”

Рекомендуемая default-позиция:

- сначала sync docs/contracts;
- затем, только если пользователь хочет реальную техработу, оформить/выполнить узкий stabilization scope;
- не раздувать объём.

## Ожидаемый результат от Quick Flow Solo Dev

Агент должен быть готов выдать один из трёх результатов:

- lean tech-spec на stabilization renderer layer;
- точечный quick-dev план и реализацию;
- нормализованный follow-up backlog без лишней бюрократии.
