# Brief: Quick Flow Solo Dev - Epic 7 Follow-up

## Контекст

Epic 7 завершён. Retrospective завершён тоже. Пользователь не просит “доделать Epic 7”, а хочет, чтобы Quick Flow Solo Dev получил весь нужный контекст для дальнейшей работы без повторного анализа проекта с нуля.

То есть задача этого brief:

- не инициировать новый workflow искусственно;
- не создавать видимость незакрытого Epic 7;
- а дать Barry готовую опорную рамку для возможного follow-up.

## Что важно понять сразу

### 1. Epic 7 уже закрыт

Не нужно:

- переписывать story;
- переоткрывать implementation cycle;
- искать “что не реализовано” в Epic 7.

### 2. Follow-up возможен, но это уже новый scope

Если пользователь попросит продолжить, это будет не “продолжение Epic 7”, а новый маленький scope после ретро.

### 3. Самая важная проблема сейчас — не feature gap

Главная проблема:

- planning docs и часть архитектурных формулировок ещё местами говорят “Markdown”;
- фактическая реализация после Story 7.1 / 7.2 уже работает через HTML Tiptap output + sanitize-before-render.

Quick Flow Solo Dev должен считать это главным контекстным риском.

## Что Barry должен считать source of truth

- `posts.content` = HTML output из Tiptap
- `gallery` != `inline-images`
- `MarkdownRenderer` = фактический HTML sanitizer/renderer, а не markdown parser pipeline
- Epic 7 = delivered and closed

## Что делать, если пользователь захочет продолжения

Barry должен предлагать только lean варианты.

### Вариант A: doc-sync без лишней бюрократии

Если пользователь хочет просто привести систему в порядок:

- обновить PRD / Architecture / Epics;
- синхронизировать термины и contract;
- не создавать лишние story/spec, если нет новой инженерной работы.

### Вариант B: узкий stabilization scope

Если пользователь хочет реальную техническую follow-up работу:

- ограничить scope renderer-layer;
- взять только deferred items по `MarkdownRenderer`;
- не смешивать это с соседним tech debt.

### Вариант C: backlog normalization

Если пользователь хочет понять, что делать дальше:

- собрать lean backlog из deferred findings;
- отделить “делать сейчас” от “оставить в debt”.

## Что Barry не должен смешивать в один batch

- stabilization `MarkdownRenderer`
- Stripe debt
- scheduled publishing reliability
- search fixes
- новый product scope

Если пользователь не просит широкий stabilization sprint, эти темы должны быть разведены.

## Самые ценные next steps, если пользователь спросит “что делать дальше?”

Приоритетный порядок:

1. Синхронизировать contract в docs.
2. Решить, нужен ли вообще технический follow-up.
3. Если нужен — делать только минимальный stabilization `MarkdownRenderer`.
4. Остальной debt оставить отдельными потоками.

## Ключевые артефакты для Barry

- `C:/Users/1/DEV/PROCONTENT/_bmad-output/implementation-artifacts/Epic 7 Retro Follow-up/quick-flow-solo-dev-context-epic-7-follow-up.md`
- `C:/Users/1/DEV/PROCONTENT/_bmad-output/implementation-artifacts/Epic 7 Retro Follow-up/context-packet-epic-7-retro-follow-up.md`
- `C:/Users/1/DEV/PROCONTENT/_bmad-output/implementation-artifacts/epic-7-retro-2026-04-09.md`
- `C:/Users/1/DEV/PROCONTENT/_bmad-output/implementation-artifacts/deferred-work.md`
- `C:/Users/1/DEV/PROCONTENT/_bmad-output/implementation-artifacts/tech-debt.md`
- `C:/Users/1/DEV/PROCONTENT/_bmad-output/planning-artifacts/prd.md`
- `C:/Users/1/DEV/PROCONTENT/_bmad-output/planning-artifacts/architecture.md`
- `C:/Users/1/DEV/PROCONTENT/_bmad-output/planning-artifacts/epics.md`
- `C:/Users/1/DEV/PROCONTENT/_bmad-output/stories/7-1-wysiwyg-editor-inline-images-posts.md`
- `C:/Users/1/DEV/PROCONTENT/_bmad-output/stories/7-2-markdown-rendering-posts-inline-images-and-combined-layout.md`
- `C:/Users/1/DEV/PROCONTENT/_bmad-output/project-context.md`

## Ожидаемое поведение Barry

Barry должен работать так:

- быстро;
- без лишней церемонии;
- без повторного product discovery;
- с опорой на уже собранный ретро-контекст;
- с прагматичным вопросом: “какой минимальный следующий шаг реально полезен?”

## Ожидаемый результат от передачи

После чтения этого brief Barry должен быть готов:

- сразу предложить lean follow-up path;
- либо сразу реализовать узкий scope, если пользователь попросит;
- либо ограничиться sync docs/contracts, если это всё, что требуется.
