# Brief: PM - Epic 7 Retro Follow-up

## Контекст

Epic 7 (`Rich Content Experience`) завершён успешно, но ретро выявило не feature gap, а planning/process gap. Реализация уже работает, однако planning artifacts и language contract нужно привести в соответствие с фактическим поведением системы, чтобы следующий цикл не стартовал на двусмысленных допущениях.

Ключевой пример: в части planning/epic language используется слово “Markdown”, но после Story 7.1 и Story 7.2 фактический contract для `posts.content` — это HTML output из Tiptap, который затем sanitizится и рендерится на клиенте.

## Цель brief

Подготовить PM к обновлению product/planning слоя после Epic 7 и к выбору следующего шага: новый product scope или stabilization-first цикл.

## Что нужно сделать PM

### 1. Синхронизировать planning artifacts с фактической реализацией

Обновить narrative в planning docs так, чтобы больше не было двусмысленности между “Markdown” и реальным HTML contract.

Минимум проверить и при необходимости обновить:

- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/epics.md`

Что зафиксировать:

- `posts.content` хранит HTML Tiptap output;
- inline images — часть article body, а не часть gallery;
- gallery и inline media остаются независимыми доменами;
- consumer-side rendering работает через sanitize + HTML render, а не через markdown pipeline.

### 2. Принять product decision по следующему циклу

PM должен определить, что рациональнее после Epic 7:

- запуск нового крупного scope;
- отдельный stabilization sprint;
- комбинированный небольшой cleanup + next-scope planning.

Рекомендация из ретро: сначала рассмотреть stabilization-first, потому что проект уже имеет накопленный deferred work и tech debt, а Epic 8 ещё не оформлен.

### 3. Нормализовать follow-up backlog на уровне продукта

PM нужно превратить выводы ретро в управляемые backlog items, а не оставлять их внутри ретро-документа.

Минимальный список:

- planning cleanup по `posts.content` contract;
- отдельный backlog item на stabilization `MarkdownRenderer`;
- backlog item на разбор deferred-work;
- process item на story close-out checklist.

## Вопросы, на которые PM должен ответить

1. Следующий цикл — это стабилизация уже доставленного rich-content flow или новый product increment?
2. Нужно ли обновлять PRD только точечно, или Epic 7 меняет формулировки требований шире, чем один эпик?
3. Какие deferred findings достаточно важны, чтобы войти в ближайший scope, а какие оставить в long-tail debt?
4. Нужен ли отдельный mini-brief на stabilization scope?

## Важные входные артефакты

- `_bmad-output/implementation-artifacts/Epic 7 Retro Follow-up/context-packet-epic-7-retro-follow-up.md`
- `_bmad-output/implementation-artifacts/epic-7-retro-2026-04-09.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/stories/7-1-wysiwyg-editor-inline-images-posts.md`
- `_bmad-output/stories/7-2-markdown-rendering-posts-inline-images-and-combined-layout.md`

## Что PM не должен потерять

- Это не запрос на новый feature rewrite.
- Это не спор о терминах ради терминов: неконсистентный contract между planning и implementation создаёт риск плохих future stories.
- Следующий шаг должен быть управляемым и малым по объёму, а не “сразу новый большой эпик без cleanup”.

## Ожидаемый результат от PM

- Обновлённые planning artifacts без терминологического дрейфа.
- Решение о формате следующего цикла.
- Нормализованный backlog follow-ups с приоритетом и понятной рамкой.
