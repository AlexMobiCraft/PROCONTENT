---
title: 'media-lightbox-viewer'
type: 'feature'
created: '2026-04-27'
status: 'in-review'
baseline_commit: '26728af6958791d8ed7c060b9d19669be1db2624'
context:
  - '{project-root}/CLAUDE.md'
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** На детальной странице поста (`/feed/[id]`) клик по фото или видео ничего не делает. Участница не может рассмотреть медиа крупно, в галереях из 5–10 штук нет навигации между элементами.

**Approach:** Добавить переиспользуемый Dumb-компонент `MediaLightbox` поверх `@base-ui/react` Dialog. Подключить в `PostDetail` для одиночного фото/видео и для `GalleryGrid`. Видео в lightbox автоплеит со звуком и интегрировано с глобальным контроллером NFR4.1 (открытие останавливает страничный плеер).

## Boundaries & Constraints

**Always:**
- `MediaLightbox.tsx` — Dumb UI (`'use client'`), props: `media`, `initialIndex`, `open`, `onClose`. Без Supabase. Допустим один side-effect: `useFeedStore.getState().setActiveVideo(null)` при открытии видео — для NFR4.1.
- Основа — `@base-ui/react` Dialog (`Dialog.Root`/`Backdrop`/`Popup`). Это даёт focus trap, scroll lock, Esc и click-outside «из коробки» — собственную модалку не пишем.
- Поля БД — `snake_case` (`media_type`, `thumbnail_url`).
- Touch-targets ≥ 44×44 px (стрелки, кнопка `×`).
- Размеры: десктоп — backdrop `bg-foreground/90 backdrop-blur-sm`, медиа в `min(95vw, 1400px) × 90vh`, центр; мобильный (<768 px) — full-screen `100dvw × 100dvh` без отступов.
- Закрытие: `Esc`, клик по фону, кнопка `×` (всегда); свайп-вниз > 120 px (мобильный); аппаратная «назад» (через `pushState` + `popstate`).
- Навигация: стрелки prev/next (десктоп), свайп влево/вправо threshold 60 px (мобильный), клавиши `←/→`, индикатор `n / total` сверху по центру. Без цикла — на крайних элементах кнопки/жесты no-op.
- Видео: `<video controls autoPlay>` в lightbox, звук **включён** (`muted={false}`). Пауза при закрытии и при переключении медиа. Перед открытием видео — `setActiveVideo(null)` (страничный плеер останавливается). При закрытии страничный плеер не возобновляется.
- Подгонка под экран: `object-contain`, без zoom/pinch/прокрутки.
- Ошибки загрузки `<img>`/`<video>`: внутренний fallback (иконка + текст), без toast.

**Ask First:**
- Если автоплей со звуком блокируется браузерами и UX страдает на десктопе — обсудить fallback (muted + кнопка unmute).

**Never:**
- Не подключать lightbox в `PostCard`, в админ-превью (deferred), в инлайн-картинки `MarkdownRenderer`.
- Не реализовывать pinch-zoom, double-tap zoom, slideshow, цикличную навигацию.
- Не менять архитектуру `GalleryGrid` (только пробросить `onMediaClick`, плюс точечная обёртка-кнопка вокруг видео-элемента).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Behavior | Errors |
|---|---|---|---|
| Открытие из галереи | клик по 3-му из 7 | lightbox открыт, `currentIndex=2`, индикатор `3 / 7`, `pushState({lightbox:true})` | — |
| Открытие одиночного медиа | клик по single photo/video | lightbox с одним элементом, стрелки и индикатор скрыты | — |
| Открытие видео | любой клик на video | сначала `setActiveVideo(null)`, затем lightbox; видео автоплеит со звуком | автоплей заблокирован — оставить controls |
| Навигация ←/→ | `→` на не-последнем | `currentIndex++`, текущее видео pause, фокус на новом медиа | на последнем — no-op |
| Свайп горизонтальный | dx < -60 (next) / > 60 (prev) | смена индекса как выше | на крайнем — no-op без bounce |
| Свайп вниз | dy > 120 px | `onClose()` | dy < 120 — отскок назад через `transition-transform` |
| Esc / клик-фон / `×` | open=true | `onClose()` (Esc и backdrop — встроены в Dialog) | — |
| Аппаратная «назад» | popstate при open=true | `onClose()` без повторного `back()` | если уже закрыт — игнор |
| Программное закрытие | любой способ кроме popstate | `history.back()` чтобы убрать запись из стека | — |
| После закрытия | unmount Popup | видео pause, фокус на trigger, scroll-lock снят, страничный плеер **не** возобновляется | — |
| Ошибка медиа | `<img>`/`<video>` `onerror` | fallback внутри Popup; навигация и индикатор работают | — |

</frozen-after-approval>

## Code Map

- `src/components/media/MediaLightbox.tsx` (new) — Dumb UI: Dialog + Popup, навигация, индикатор, swipe, fallback.
- `tests/unit/components/media/MediaLightbox.test.tsx` (new) — Vitest unit-тесты по I/O Matrix.
- `src/components/feed/PostDetail.tsx` — state `lightboxIndex: number | null`, обёртки-кнопки вокруг single photo и single video, `onMediaClick` пробросить в `GalleryGrid`, рендер `<MediaLightbox>`.
- `src/components/feed/GalleryGrid.tsx` — обёртка-кнопка поверх `VideoPlayerContainer` с проверкой `(e.target).closest('video')`, чтобы клик по нативным controls не открывал lightbox (паттерн уже использован в `PostCard.tsx`).
- `tests/unit/components/feed/PostDetail.test.tsx` — расширить.
- `tests/unit/components/feed/GalleryGrid.test.tsx` — добавить тест клика по видео-элементу галереи.
- `src/features/feed/types.ts` — `PostMedia` уже подходит; в lightbox используем минимальный `LightboxMedia`-тип, объявленный локально в `MediaLightbox.tsx`.

## Tasks & Acceptance

**Execution:**
- [x] `src/components/media/MediaLightbox.tsx` — `Dialog.Root open onOpenChange={v => !v && onClose()} dismissible modal`. Внутри `Dialog.Backdrop` (стилизация выше) + `Dialog.Popup`. Внутреннее состояние: `currentIndex`, pointer-handlers (dx/dy threshold), keyboard-handler (`ArrowLeft/Right`). Эффект на `open=true`: `setActiveVideo(null)` + `pushState` + `popstate`-listener вызывает `onClose()`. При программном `onClose` через cleanup — `history.back()`. Видео — нативный `<video controls autoPlay>` без `useVideoController` (lightbox-плеер изолирован). При смене `currentIndex` — `videoRef.current?.pause()`.
- [x] `tests/unit/components/media/MediaLightbox.test.tsx` — тесты по сценариям матрицы: открытие/закрытие (Esc, backdrop, ×, свайп-вниз, popstate), навигация (стрелки/клавиши/свайп), индикатор `n / total`, скрытие нав. при `length=1`, видео автоплей и pause при переключении/закрытии, `setActiveVideo(null)` через мок Zustand, fallback при `<img onError>`.
- [x] `src/components/feed/PostDetail.tsx` — `useState<number | null>` для `lightboxIndex`. `onMediaClick={(i) => setLightboxIndex(i)}` на `GalleryGrid`. Single photo обернуть в `<button onClick={() => setLightboxIndex(0)} aria-label={post.title}>`. Single video — `<div role="button">` поверх `VideoPlayerContainer` с проверкой `e.target` (как в PostCard) — клик мимо нативных controls вызывает `setLightboxIndex(0)`. В конец JSX — `<MediaLightbox media={post.media ?? [singleAsLightboxMedia]} initialIndex={lightboxIndex ?? 0} open={lightboxIndex !== null} onClose={() => setLightboxIndex(null)} />`.
- [x] `src/components/feed/GalleryGrid.tsx` — обернуть видео-элемент в `<div role="button" onClick={(e) => { if (!(e.target as HTMLElement).closest('video')) onMediaClick?.(i) }} tabIndex={0} onKeyDown={Enter/Space}>`. Сохранить существующий рендер `VideoPlayerContainer` внутри. Поведение фото уже корректно (`<button>` обёртка существует).
- [x] `tests/unit/components/feed/PostDetail.test.tsx` — клик по single photo открывает lightbox с `initialIndex=0`; клик по галерее (моck `onMediaClick`) открывает с правильным индексом; клик по controls видео (target=video) lightbox не открывает.
- [x] `tests/unit/components/feed/GalleryGrid.test.tsx` — клик по контейнеру видео вызывает `onMediaClick`; клик по элементу `<video>` (target=video) — не вызывает.

**Acceptance Criteria:**
- Given `/feed/[id]` с галереей из 7 фото, when клик по 3-му, then lightbox открыт, индикатор `3 / 7`, видны стрелки prev/next.
- Given lightbox с видео открыт, when видео загружено, then автоплей со звуком; when `→` или свайп влево, then видео pause, переходим к следующему.
- Given страничный плеер играл, when открыт lightbox, then страничный плеер на паузе; when lightbox закрыт, then страничный плеер остаётся на паузе (не autoresume).
- Given mobile viewport, when свайп-вниз > 120 px или аппаратная «назад», then lightbox закрыт без ухода со страницы поста.
- Given lightbox закрыт любым способом, then фокус возвращён на trigger, scroll-lock снят, видео-плеер lightbox unmount-ится.
- Given одиночное фото в посте, when клик по нему, then lightbox открыт с одним элементом без стрелок и индикатора.
- Given первый элемент галереи, when `←` или свайп вправо, then no-op (нет цикла); аналогично для последнего и `→`.

## Spec Change Log

## Design Notes

**`@base-ui/react` Dialog**: `Dialog.Root` принимает `open`, `onOpenChange`, `dismissible`, `modal`. `Dialog.Backdrop` рендерится автоматически при `modal`, стилизуется через className. `Dialog.Popup` — focus trap по умолчанию.

**История браузера**: `pushState({lightbox:true},'')` на open. `popstate` вызывает `onClose()` (back уже сделан системой). Программное закрытие (Esc/backdrop/×/свайп) делает `history.back()` — чтобы убрать запись и не оставлять «висящий» state.

**Pointer-handlers (mobile)**: один общий `onPointerDown/Move/Up`. Трекаем dx, dy. Если `|dx| > |dy|` и `|dx| > 60` — навигация. Если `dy > |dx|` и `dy > 0` — translateY (визуальный отскок), закрываем при dy > 120.

**Размеры (Tailwind)**:
- Popup desktop: `fixed inset-0 z-50 flex items-center justify-center p-8`, внутри `max-w-[min(95vw,1400px)] max-h-[90vh]`.
- Popup mobile: `md:p-8 p-0`, медиа `w-[100dvw] h-[100dvh]` или `max-w-full max-h-full`.
- Медиа: `<img className="max-h-full max-w-full object-contain">`.

## Verification

**Commands:**
- `npm run typecheck` — 0 ошибок.
- `npm run lint` — 0 ошибок.
- `npm run test` — все тесты зелёные, включая новый `MediaLightbox.test.tsx`.

**Manual checks:**
- Desktop Chrome: `/feed/[id]` с галереей ≥ 5 → клик по фото → lightbox корректных размеров → ←/→ → Esc/click-фон → фокус возвращён.
- Mobile devtools (375×667): свайп-нав, свайп-вниз, popstate (DevTools history) — lightbox закрыт.
- Видео в lightbox: автоплей со звуком; переключение → pause; закрытие → pause; страничный плеер до открытия играл — после закрытия остаётся на паузе.
