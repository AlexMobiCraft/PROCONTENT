---
title: 'Рабочий свайп пальцем между медиа в lightbox на мобильном'
type: 'bugfix'
created: '2026-06-07'
status: 'draft'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** При просмотре поста с несколькими медиа в полноэкранном `MediaLightbox` на мобильном переключение работает только кнопками-стрелками — листание пальцем не срабатывает. Код свайпа (`handlePointerDown/Move/Up`) в компоненте уже есть и проходит unit-тесты с синтетическими событиями, но на реальном тач-устройстве жест не завершается.

**Approach:** Включить браузерную передачу жеста в JS, задав `touch-action: none` на поверхности изображения (иначе UA перехватывает pan и шлёт `pointercancel` до `pointerup`), и удержать поток pointer-событий через `setPointerCapture`. Для видео жест свайпа не перехватываем — оставляем нативные controls (скраб).

## Boundaries & Constraints

**Always:** Чинить только `MediaLightbox`. Горизонтальный свайп (порог 60px) переключает медиа, вертикальный вниз (порог 120px) закрывает — пороги и существующая логика `goPrev/goNext` сохраняются. При диагональном жесте побеждает доминантная ось на `pointerup` (`|dx| > |dy|` → навигация, иначе закрытие) — логика уже в коде. Кнопки-стрелки, клавиатура (Arrow), индикатор `n / total`, кнопка ×, пауза видео и history-стек продолжают работать без регрессий. Минимальный touch target 44px сохранён.

**Ask First:** Изменение визуального поведения (анимации перехода между слайдами, добавление «резинки»/follow-drag по горизонтали) — это за рамками фикса, спросить прежде чем делать.

**Never:** Не трогать `GalleryGrid`, `PostDetail`, другие компоненты. Не вводить сторонние свайп-библиотеки. Не ломать нативный скраб/controls видео — `touch-action: none` вешается **условно только когда текущее медиа — изображение** (при видео touch-action отсутствует, поэтому предок видео жест не блокирует). Не менять контракт props компонента.

**Known Limitations (приняты осознанно, вне scope фикса):**
- **Pinch-zoom** двумя пальцами на фото блокируется `touch-action: none`. Зума в lightbox сегодня нет, поэтому регрессии существующего поведения нет — фиксируем как ограничение, не как баг.
- **Velocity-flick:** порог переключения — расстояние 60px, без проверки скорости. Короткий быстрый флик (<60px) не переключит слайд. → UX debt.
- **Follow-drag:** изображение не «прилипает» к пальцу во время свайпа (нет визуального drag-feedback до отпускания). → UX debt.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Свайп влево на изображении (тач) | media.length>1, не последний | Переход к следующему медиа | N/A |
| Свайп вправо на изображении (тач) | media.length>1, не первый | Переход к предыдущему медиа | N/A |
| Свайп вниз >120px | open | Закрытие lightbox | N/A |
| Свайп начат на кнопке-стрелке/× | — | Жест игнорируется, отрабатывает клик | N/A |
| Свайп/драг на видео | currentMedia=video | Жест навигации НЕ перехватывается, работают нативные controls | N/A |
| Микро-свайп <60px горизонт. | — | No-op, индекс не меняется | N/A |
| Диагональный свайп (dx≈dy) | tracking | Побеждает доминантная ось на `pointerup` (`|dx|>|dy|` → навигация, иначе закрытие) — уже в коде | N/A |
| Свайп влево на последнем / вправо на первом | граница галереи | No-op (кламп индекса в `goNext/goPrev`) — уже в коде | N/A |
| Свайп вверх | — | No-op (вертикаль вверх не отслеживается) — уже в коде | N/A |
| Pinch-zoom двумя пальцами на фото | image + `touch-none` | Зум заблокирован — known-limitation (зума в lightbox нет) | N/A |

</frozen-after-approval>

## Code Map

- `src/components/media/MediaLightbox.tsx` -- единственный изменяемый файл:
  - pointer-handlers (94–128): `handlePointerDown` (94–98), `handlePointerMove` (100–108), `handlePointerUp` (110–123), `handlePointerCancel` (125–128) — **все уже существуют**; `handlePointerCancel` уже сбрасывает `pointerRef`+`translateY`, его НЕ нужно создавать заново
  - handlers висят на `Dialog.Popup` (147–150), поэтому `e.currentTarget` в них = Popup → `setPointerCapture` захватывает Popup (корректно)
  - контейнер `lightbox-media-wrap` (213–216) — сюда вешать условный `touch-none`
  - элемент `<img>` (245–252), `<video>` (228–242)
- `tests/unit/components/media/MediaLightbox.test.tsx` -- существующие swipe-тесты (207–248); добавить проверку early-return на видео. ⚠️ jsdom не имеет gesture-engine и не шлёт `pointercancel` — unit-тест проверяет только early-return логику, НЕ реальный скраб/свайп на устройстве

## Tasks & Acceptance

**Execution:**
- [ ] `src/components/media/MediaLightbox.tsx` -- добавить `touch-none` (touch-action: none) на контейнер `lightbox-media-wrap` (213–216) **условно**: `cn('...', currentMedia.media_type === 'image' && 'touch-none')`. Покрывает всю площадь свайпа, включая тёмные поля вокруг `object-contain`-фото; при видео класс отсутствует → правило предков не нарушается, нативный скраб цел. На `<img>` дублировать не нужно. -- корневая причина неработающего свайпа на мобильном
- [ ] `src/components/media/MediaLightbox.tsx` -- в `handlePointerDown` дополнительно `return`, если `target.closest('video')` — не перехватывать жесты на видео (события из UA shadow-DOM controls ретаргетятся на сам `<video>`, поэтому guard их ловит); навигация между видео остаётся через кнопки/клавиатуру
- [ ] `src/components/media/MediaLightbox.tsx` -- в `handlePointerDown` вызвать `setPointerCapture(e.pointerId)` на `e.currentTarget`. В `handlePointerUp` и `handlePointerCancel` — освобождать через явную проверку: `if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)` (Safari/Chrome по-разному ведут себя, если при `pointercancel` capture уже отпущен браузером). ⚠️ `handlePointerCancel` сейчас вызывается без аргумента (`function handlePointerCancel()`, строка 125 и `onPointerCancel={handlePointerCancel}` строка 150) — добавить параметр `e: React.PointerEvent`, чтобы получить `pointerId`
- [ ] `tests/unit/components/media/MediaLightbox.test.tsx` -- добавить тест: `pointerDown` с target=видео не меняет индекс (early-return для видео)

**Acceptance Criteria:**
- Given пост с ≥2 изображениями открыт в lightbox на мобильном (или эмуляции тача), when пользователь свайпает пальцем влево/вправо по изображению, then медиа переключается и индикатор обновляется — без нажатия кнопок.
- Given открыт lightbox, when пользователь свайпает вниз >120px, then lightbox закрывается.
- Given текущее медиа — видео, when пользователь взаимодействует с таймлайном/controls, then нативный скраб работает и жест не уводит на соседнее медиа.
- Given существующие unit-тесты, when выполняется `npm run test`, then все проходят (включая прежние swipe- и видео-тесты).
- **Given пост с ≥2 фото открыт на физическом устройстве (Chrome Android И iOS Safari), when пользователь свайпает пальцем влево/вправо, then медиа переключается. Проверяется ручным тестом на устройстве, НЕ unit-тестом** — jsdom не воспроизводит реальный тач-поток, который и проморгал баг изначально.

## Design Notes

`touch-action` определяется элементом под пальцем и его предками. Вешать его **постоянно** на `Dialog.Popup` или `lightbox-media-wrap` нельзя — это предки видео, скраб сломается (правило предков). Но фото и видео никогда не отображаются одновременно, поэтому решение — **условный** `touch-none` на `lightbox-media-wrap` только при `currentMedia.media_type === 'image'`: при видео класса нет, предок чист. Это лучше, чем `touch-none` только на `<img>`, потому что покрывает и тёмные поля вокруг `object-contain`-фото (свайп, начатый в полях, иначе не сработал бы).

`setPointerCapture` и `touch-action: none` дополняют друг друга: `touch-action: none` *предотвращает* отмену жеста браузером (нет `pointercancel`), а `setPointerCapture` *удерживает* поток событий, если палец вышел за пределы стартового элемента до `pointerup`. Порядок: capture ставится в `pointerdown` сразу.

> ⚠️ **Архитектурный инвариант:** при появлении нового типа медиа со свайпом (PDF-превью, iframe, canvas) условие `touch-none` на `lightbox-media-wrap` нужно расширить — иначе свайп для него молча сломается. Оставить комментарий у враппера в коде.

Пример (handlePointerDown):
```ts
const target = e.target as HTMLElement
if (target.closest('button') || target.closest('video')) return
;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
pointerRef.current = { startX: e.clientX, startY: e.clientY, tracking: true }
```

Пример (handlePointerUp / handlePointerCancel — освобождение capture):
```ts
const el = e.currentTarget as HTMLElement
if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)
```

**UX debt (out of scope, зафиксировано в Known Limitations):** velocity-flick (короткий быстрый флик <60px не переключает) и follow-drag (нет визуального прилипания фото к пальцу до отпускания — переключение ощущается «деревянным»). Для bugfix-релиза приемлемо; вносить отдельной задачей.

## Verification

**Commands:**
- `npm run test -- MediaLightbox` -- expected: все тесты MediaLightbox зелёные, включая новый видео-тест
- `npm run typecheck` -- expected: без ошибок
- `npm run lint` -- expected: без новых ошибок

**Manual checks (обязательны — unit-тесты слепы к реальному тач-потоку):**
- В DevTools device toolbar (эмуляция тача) открыть пост с несколькими фото → свайп влево/вправо переключает фото; свайп вниз закрывает. Видео: скраб таймлайна работает.
- **На физическом устройстве — Chrome Android И iOS Safari:** свайп влево/вправо переключает фото, свайп вниз закрывает, скраб видео работает. Это единственная достоверная проверка корневого фикса.

**Доказательство гипотезы и чеклист отладки (если свайп всё ещё не работает после фикса):**
- ДО фикса — на реальном устройстве в DevTools (remote debugging) залогировать pointer-события и убедиться, что приходит `pointercancel` до `pointerup`. Это превращает заявленную корневую причину из предположения в подтверждённый факт.
- Если свайп всё ещё мёртв после фикса, проверить альтернативные причины:
  - нет ли `pointer-events: none` в цепочке предков `<img>`/`lightbox-media-wrap`;
  - вызывается ли `setPointerCapture` в `pointerdown` ДО того, как UA отменяет жест;
  - не перехватывает ли события scroll-контейнер-предок (`overflow: auto/scroll`) выше по дереву;
  - специфика iOS Safari — там `pointercancel` может приходить по иным триггерам, чем в Chrome.
