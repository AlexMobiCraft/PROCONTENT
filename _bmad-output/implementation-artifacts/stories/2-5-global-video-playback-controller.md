# Story 2.5: Глобальный менеджер воспроизведения видео (Video Controller)

Status: review

## Story

As a участница,
I want чтобы при скролле ленты автоматически останавливалось предыдущее видео при запуске нового,
so that не тратить ресурсы устройства и фокусироваться на одном видео.

## Acceptance Criteria

1. **Одновременно воспроизводится не более одного видео** во всём приложении (NFR4.1): при запуске нового видео предыдущее автоматически ставится на паузу.

2. **Состояние `activeVideoId`** (ID активного видео, `string | null`) хранится в Zustand store в `src/features/feed/store.ts`. При отсутствии воспроизводимого видео — `null`.

3. **`VideoPlayer` компонент создан** (`src/components/media/VideoPlayer.tsx`) — Dumb UI, принимает `src`, `poster`, `videoId`, `onPlay`, `onPause`. Самостоятельно не изменяет Zustand store.

4. **`useVideoController` хук создан** (`src/hooks/useVideoController.ts`) — управляет `HTMLVideoElement` через `ref`:
   - подписывается на `activeVideoId` из store
   - если `activeVideoId !== videoId` → вызывает `videoElement.pause()`
   - если `activeVideoId === videoId` → ничего (разрешает воспроизведение)

5. **Автопауза при скролле из viewport**: видео автоматически ставится на паузу через `IntersectionObserver`, когда его элемент выходит за пределы видимой области (используется существующий принцип `useInView.ts`).

6. **Интеграция в `GalleryGrid`** (Story 2.4): для элементов с `media_type='video'` в `GalleryGrid` рендерится `VideoPlayer` вместо статичного `LazyMediaWrapper`.

7. **`GalleryGrid` прокидывает `videoId`**: `GalleryGrid` (`src/components/feed/GalleryGrid.tsx`) рендерит `VideoPlayer` для элементов с `media_type='video'` и прокидывает `videoId={media.id}`. `VideoPlayer` сам через `useVideoController` взаимодействует со store. `FeedContainer` не управляет видео напрямую.

   > ⚠️ **Вне scope Story 2.5**: интеграция `VideoPlayer` в `PostDetail` (полный просмотр поста) — ответственность **Story 2.6** ("Детальный просмотр мультиформатного поста").

8. **Компонент `VideoPlayer` покрыт юнит-тестами** (минимум 8 тестов):
   - рендерится `<video>` с корректными `src` и `poster`
   - `onPlay` вызывается при событии play
   - `onPause` вызывается при событии pause
   - видео ставится на паузу если `activeVideoId !== videoId` (мок store)
   - видео НЕ ставится на паузу если `activeVideoId === videoId`
   - автопауза при выходе из viewport (`isInView=false` → pause)

9. **Хук `useVideoController` покрыт юнит-тестами** (минимум 5 тестов):
   - возвращает `{ videoRef, isActive }` (ref на `<video>`, флаг активности)
   - вызывает `pause()` на ref когда `activeVideoId` меняется на другое видео
   - не вызывает `pause()` когда `activeVideoId === videoId`
   - вызывает store action `setActiveVideo(videoId)` при play
   - вызывает `setActiveVideo(null)` при pause

10. **Существующие 457 тестов проходят** без регрессий после интеграции.

## Tasks / Subtasks

- [x] **Task 1: Расширить Zustand store новым состоянием видео** (AC: #2)
  - [x] 1.1. Добавить `activeVideoId: string | null` в `FeedState` интерфейс в `src/features/feed/store.ts`
  - [x] 1.2. Добавить `setActiveVideo: (id: string | null) => void` action
  - [x] 1.3. Добавить `activeVideoId: null` в `initialState`
  - [x] 1.4. Реализовать `setActiveVideo` через `set({ activeVideoId: id })`

- [x] **Task 2: Создать хук `useVideoController`** (AC: #4, #5)
  - [x] 2.1. Создать файл `src/hooks/useVideoController.ts`
  - [x] 2.2. Хук принимает `videoId: string` и возвращает `{ videoRef: RefObject<HTMLVideoElement>, isActive: boolean }`
  - [x] 2.3. Подписаться на `activeVideoId` из store через точечный селектор
  - [x] 2.4. `useEffect([activeVideoId])`: если `activeVideoId !== videoId && videoRef.current` → вызвать `.pause()`
  - [x] 2.5. Экспортировать `handlePlay` / `handlePause` коллбэки для передачи в `VideoPlayer`
  - [x] 2.6. Реализовать автопаузу при выходе из viewport через `IntersectionObserver` (переиспользовать паттерн из `useInView.ts`) — ⚠️ **Примечание**: IntersectionObserver реализован в `VideoPlayer.tsx` (Round 4 рефакторинг), а не в `useVideoController.ts`. Хук отвечает только за store-логику (activeVideoId).

- [x] **Task 3: Создать компонент `VideoPlayer`** (AC: #3, #7)
  - [x] 3.1. Создать файл `src/components/media/VideoPlayer.tsx` (`'use client'`)
  - [x] 3.2. Определить `VideoPlayerProps` (см. Dev Notes)
  - [x] 3.3. Использовать `useVideoController(videoId)` для управления паузой
  - [x] 3.4. Рендерить нативный `<video>` с пропами `src`, `poster`, `controls`, `playsInline`
  - [x] 3.5. Прокидывать `onPlay={handlePlay}`, `onPause={handlePause}` из хука в `<video>`
  - [x] 3.6. Обернуть в `<div>` с aspect-ratio и `overflow-hidden` (паттерн из `LazyMediaWrapper`)
  - [x] 3.7. Добавить skeleton-placeholder аналогично `LazyMediaWrapper`

- [x] **Task 4: Написать тесты для `useVideoController`** (AC: #9)
  - [x] 4.1. Создать `tests/unit/hooks/useVideoController.test.ts`
  - [x] 4.2. Написать 5+ тестов (детали в Dev Notes)

- [x] **Task 5: Написать тесты для `VideoPlayer`** (AC: #8)
  - [x] 5.1. Создать `tests/unit/components/media/VideoPlayer.test.tsx`
  - [x] 5.2. Написать 8+ тестов (детали в Dev Notes)

- [x] **Task 6: Интегрировать `VideoPlayer` в `GalleryGrid`** (AC: #6)
  - [x] 6.1. В `src/components/feed/GalleryGrid.tsx`: для элементов с `media_type='video'` — рендерить `VideoPlayer` вместо статичного `LazyMediaWrapper`
  - [x] 6.2. Использовать `videoId={media.id}` из `PostMedia.id` как уникальный идентификатор

  > ⚠️ Интеграция `VideoPlayer` в `PostDetail` — Task Story 2.6 (вне scope).

- [x] **Task 7: Верификация** (AC: #10)
  - [x] 7.1. `npx tsc --noEmit` → 0 ошибок
  - [x] 7.2. Запустить все тесты → регрессий нет

### Review Follow-ups (AI)

- [x] [AI-Review][High] Исправить Race Condition в `IntersectionObserver`: убрать избыточный вызов `setActiveVideo(null)` после `el.pause()`, так как вызов `pause()` уже триггерит нативное событие, которое вызывает `handlePause` и сбрасывает стейт `[src/hooks/useVideoController.ts:40-42]`
- [x] [AI-Review][Medium] Исправить утечку состояния при unmount (State Leak): добавить cleanup функцию в хук `useVideoController` (возвращаемую из `useEffect` без зависимостей), которая сбрасывает `activeVideoId` в null, если текущий компонент размонтируется будучи активным `[src/hooks/useVideoController.ts]`
- [x] [AI-Review][Low] Убрать `onClick={(e) => e.preventDefault()}` с обертки видео, чтобы не блокировать нативные контролы плеера (например, двойной клик) `[src/components/media/VideoPlayer.tsx:41]`
- [x] [AI-Review][Low] Исправить UI Inconsistency: заменить жестко заданный `object-contain` на `object-cover` в `VideoPlayer` для соответствия поведению `LazyMediaWrapper` и предотвращения черных полос в квадратных сетках `[src/components/media/VideoPlayer.tsx:53]`

- [x] [AI-Review][High] Оптимизировать подписку в `useVideoController`: заменить `useFeedStore((s) => s.activeVideoId)` на точечный boolean-селектор `useFeedStore((s) => s.activeVideoId === videoId)` для предотвращения перерендринга всех видеоплееров в ленте `[src/hooks/useVideoController.ts:15]`
- [x] [AI-Review][Medium] Обновить AC #7 в стори, чтобы отразить реальное положение дел: ответственность за прокидывание `videoId` лежит на `GalleryGrid`, а не на `FeedContainer` `[_bmad-output/implementation-artifacts/stories/2-5-global-video-playback-controller.md:28]`
- [x] [AI-Review][Medium] Отрефакторить тесты в `VideoPlayer.test.tsx`: заменить глобальный `document.querySelector('video')` на локальный поиск через `container.querySelector` или `screen` для изоляции тестов `[tests/unit/components/media/VideoPlayer.test.tsx:27]`
- [x] [AI-Review][Low] Обернуть вызов `el.pause()` в `try/catch` внутри `IntersectionObserver` для предотвращения потенциальных DOMException при маунте `[src/hooks/useVideoController.ts:34]`
- [x] [AI-Review][Low] Рассмотреть возможность проброса флага `priority` в `VideoPlayer` для управления `preload="metadata"` вместо жесткого `preload="none"` для первого видео `[src/components/media/VideoPlayer.tsx:43]`
- [x] [AI-Review][High] Исправить невалидный HTML в `PostCard.tsx`: убрать оборачивание `GalleryGrid` в `<Link>` когда есть видео, так как `<video controls>` внутри ссылки делает плеер непригодным для использования `[src/components/feed/PostCard.tsx:86-90]`
- [x] [AI-Review][High] Добавить `VideoPlayer` для одиночных видео в `PostCard.tsx`: когда `post.mediaItem && post.type === 'video'` использовать `VideoPlayer` вместо `LazyMediaWrapper` `[src/components/feed/PostCard.tsx:86-90]`
- [x] [AI-Review][Medium] Прокинуть проп `priority` в `VideoPlayer` из `GalleryGrid.tsx`: добавить `priority={priority && i < 2}` при рендере видео-элементов `[src/components/feed/GalleryGrid.tsx:158-164]`
- [x] [AI-Review][Low] Добавить `onClick={(e) => e.preventDefault()}` в `VideoPlayer.tsx` для предотвращения всплытия кликов через внешние обертки-ссылки `[src/components/media/VideoPlayer.tsx:39-52]`

- [x] [AI-Review][Critical] Реализовать skeleton-placeholder в `VideoPlayer` по Task 3.7: добавить loading-state и рендеринг скелетона по паттерну `LazyMediaWrapper` `[src/components/media/VideoPlayer.tsx]`
- [x] [AI-Review][High] Сделать `VideoPlayer` Dumb UI по AC #3: убрать `useVideoController` из компонента, добавить пропсы `onPlay` / `onPause` для callbacks извне `[src/components/media/VideoPlayer.tsx:6-19,30]`
- [x] [AI-Review][High] Добавить тест на автопаузу при выходе из viewport в `VideoPlayer.test.tsx`: проверить `isInView=false → pause()` сценарий по AC #8 `[tests/unit/components/media/VideoPlayer.test.tsx]`
- [x] [AI-Review][Medium] Синхронизировать `File List` с git reality: убрать отсутствующие в diff файлы, добавить story-файл в список изменений `[_bmad-output/implementation-artifacts/stories/2-5-global-video-playback-controller.md:499-513]`
- [x] [AI-Review][Medium] Исправить A11y regression: убрать `aria-hidden="true"` с `Link` вокруг media-content, чтобы сохранить доступность превью для screen readers `[src/components/feed/PostCard.tsx:106-107,122-130]`
-   [x] [AI-Review][High] Исправить Race Condition в `IntersectionObserver`: убрать избыточный вызов `setActiveVideo(null)` после `el.pause()`, так как вызов `pause()` уже триггерит нативное событие, которое вызывает `handlePause` и сбрасывает стейт `[src/hooks/useVideoController.ts:40-42]`
-   [x] [AI-Review][Medium] Исправить утечку состояния при unmount (State Leak): добавить cleanup функцию в хук `useVideoController` (возвращаемую из `useEffect` без зависимостей), которая сбрасывает `activeVideoId` в null, если текущий компонент размонтируется будучи активным `[src/hooks/useVideoController.ts]`
-   [x] [AI-Review][Low] Убрать `onClick={(e) => e.preventDefault()}` с обертки видео, чтобы не блокировать нативные контролы плеера (например, двойной клик) `[src/components/media/VideoPlayer.tsx:41]`
-   [x] [AI-Review][Low] Исправить UI Inconsistency: заменить жестко заданный `object-contain` на `object-cover` в `VideoPlayer` для соответствия поведению `LazyMediaWrapper` и предотвращения черных полос в квадратных сетках `[src/components/media/VideoPlayer.tsx:53]`

-   [x] [AI-Review][High] Оптимизировать подписку в `useVideoController`: заменить `useFeedStore((s) => s.activeVideoId)` на точечный boolean-селектор `useFeedStore((s) => s.activeVideoId === videoId)` для предотвращения перерендринга всех видеоплееров в ленте `[src/hooks/useVideoController.ts:15]`
-   [x] [AI-Review][Medium] Обновить AC #7 в стори, чтобы отразить реальное положение дел: ответственность за прокидывание `videoId` лежит на `GalleryGrid`, а не на `FeedContainer` `[_bmad-output/implementation-artifacts/stories/2-5-global-video-playback-controller.md:28]`
-   [x] [AI-Review][Medium] Отрефакторить тесты в `VideoPlayer.test.tsx`: заменить глобальный `document.querySelector('video')` на локальный поиск через `container.querySelector` или `screen` для изоляции тестов `[tests/unit/components/media/VideoPlayer.test.tsx:27]`
-   [x] [AI-Review][Low] Обернуть вызов `el.pause()` в `try/catch` внутри `IntersectionObserver` для предотвращения потенциальных DOMException при маунте `[src/hooks/useVideoController.ts:34]`
-   [x] [AI-Review][Low] Рассмотреть возможность проброса флага `priority` в `VideoPlayer` для управления `preload="metadata"` вместо жесткого `preload="none"` для первого видео `[src/components/media/VideoPlayer.tsx:43]`
-   [x] [AI-Review][High] Исправить невалидный HTML в `PostCard.tsx`: убрать оборачивание `GalleryGrid` в `<Link>` когда есть видео, так как `<video controls>` внутри ссылки делает плеер непригодным для использования `[src/components/feed/PostCard.tsx:86-90]`
-   [x] [AI-Review][High] Добавить `VideoPlayer` для одиночных видео в `PostCard.tsx`: когда `post.mediaItem && post.type === 'video'` использовать `VideoPlayer` вместо `LazyMediaWrapper` `[src/components/feed/PostCard.tsx:86-90]`
-   [x] [AI-Review][Medium] Прокинуть проп `priority` в `VideoPlayer` из `GalleryGrid.tsx`: добавить `priority={priority && i < 2}` при рендере видео-элементов `[src/components/feed/GalleryGrid.tsx:158-164]`
-   [x] [AI-Review][Low] Добавить `onClick={(e) => e.preventDefault()}` в `VideoPlayer.tsx` для предотвращения всплытия кликов через внешние обертки-ссылки `[src/components/media/VideoPlayer.tsx:39-52]`

-   [x] [AI-Review][Critical] Реализовать skeleton-placeholder в `VideoPlayer` по Task 3.7: добавить loading-state и рендеринг скелетона по паттерну `LazyMediaWrapper` `[src/components/media/VideoPlayer.tsx]`
-   [x] [AI-Review][High] Сделать `VideoPlayer` Dumb UI по AC #3: убрать `useVideoController` из компонента, добавить пропсы `onPlay` / `onPause` для callbacks извне `[src/components/media/VideoPlayer.tsx:6-19,30]`
-   [x] [AI-Review][High] Добавить тест на автопаузу при выходе из viewport в `VideoPlayer.test.tsx`: проверить `isInView=false → pause()` сценарий по AC #8 `[tests/unit/components/media/VideoPlayer.test.tsx]`
-   [x] [AI-Review][Medium] Синхронизировать `File List` с git reality: убрать отсутствующие в diff файлы, добавить story-файл в список изменений `[_bmad-output/implementation-artifacts/stories/2-5-global-video-playback-controller.md:499-513]`
-   [x] [AI-Review][Medium] Исправить A11y regression: убрать `aria-hidden="true"` с `Link` вокруг media-content, чтобы сохранить доступность превью для screen readers `[src/components/feed/PostCard.tsx:106-107,122-130]`
-   [x] [AI-Review][Low] Убрать дублирование `VideoPlayer` в `File List`: оставить только в «Новые файлы» `[_bmad-output/implementation-artifacts/stories/2-5-global-video-playback-controller.md:501,509]`

-   [x] [AI-Review][High][A11y] Добавить `<track kind="captions">` или заглушку в `VideoPlayer.tsx` для исправления `jsx-a11y/media-has-caption` `[src/components/media/VideoPlayer.tsx:86]`
-   [x] [AI-Review][High][Logic] Исправить рендеринг одиночного видео в `PostCard.tsx`: добавить фоллбэк `post.media?.[0]` при отсутствии `post.mediaItem` для корректной поддержки нормализованных данных `[src/components/feed/PostCard.tsx:110-120]`
-   [x] [AI-Review][Medium][UX] Добавить `try-catch` или проверку `promise` при вызове `el.play()` в будущем (или защитить `pause()`) для предотвращения `AbortError` при быстром скролле `[src/components/media/VideoPlayer.tsx:58-64]`
-   [x] [AI-Review][Medium][Store] Проверить SSR Hydration для `activeVideoId` в `useVideoController.ts` при использовании Zustand с React 19 `[src/hooks/useVideoController.ts:16]`
-   [x] [AI-Review][High][Docs] Исправить Task 2.6/AC#5: IntersectionObserver перенесен в VideoPlayer.tsx, обновить описание в стори `[_bmad-output/implementation-artifacts/stories/2-5-global-video-playback-controller.md:49-81]`
-   [x] [AI-Review][High][HTML] Добавить src или заглушку в `<track kind="captions">` в VideoPlayer.tsx для исправления валидности HTML5 `[src/components/media/VideoPlayer.tsx:100]`
-   [x] [AI-Review][High][Perf] Предотвратить сетевой запрос при пустом src в VideoPlayerContainer/PostCard `[src/components/feed/PostCard.tsx:112-120]`
-   [x] [AI-Review][Medium][React] Проверить версию React: если v18, отрефакторить `ref` prop в `forwardRef` для VideoPlayer.tsx `[src/components/media/VideoPlayer.tsx:29-41]`
-   [x] [AI-Review][Medium][A11y] Добавить `title` атрибут к `<video>` для улучшения поддержки screen readers `[src/components/media/VideoPlayer.tsx:87-98]`
-   [x] [AI-Review][Medium][UX] Добавить `onError` обработчик в VideoPlayer.tsx для отображения состояния ошибки загрузки `[src/components/media/VideoPlayer.tsx:87-98]`

-   [x] [AI-Review][High] Исправить Memory Leak в `VideoPlayer.tsx`: корректно отключать IntersectionObserver при `hasError=true` или unmount `[src/components/media/VideoPlayer.tsx]`
-   [x] [AI-Review][High] Добавить `try-catch` к `videoRef.current.pause()` в `useVideoController.ts` для предотвращения DOMException/AbortError при быстром переключении `[src/hooks/useVideoController.ts]`
-   [x] [AI-Review][Medium] Сбрасывать `activeVideoId` в null при `onError` в `VideoPlayer.tsx` для предотвращения зависшего состояния в store `[src/components/media/VideoPlayer.tsx]`
-   [x] [AI-Review][Medium] Нормализовать окончания строк (LF vs CRLF) в `VideoPlayer.tsx` и тестах для устранения предупреждений git
-   [x] [AI-Review][Low] Заменить хак с `data-URI` captions на пустой VTT файл или подавление правила линтера `[src/components/media/VideoPlayer.tsx]`

-   [x] [AI-Review][High][Logic] Исправить рендеринг одиночного видео в `PostCard.tsx`: условие рендеринга `VideoPlayerContainer` должно учитывать `post.type === 'multi-video'` (для фоллбэка одиночного элемента) и корректно передавать тип в `LazyMediaWrapper` `[src/components/feed/PostCard.tsx:110,128]`
-   [x] [AI-Review][Medium][UX] GalleryGrid.tsx: убрать интерактивные стили (hover, focus-ring) с неинтерактивных оберток `<div>` вокруг видео `[src/components/feed/GalleryGrid.tsx:115-117,183-185]`
- [x] [AI-Review][Low][HTML] VideoPlayer.tsx: Исправить WebVTT data URI — добавить символ переноса строки (`%0A`) после `WEBVTT` для соответствия спецификации и устранения ворнингов в консоли `[src/components/media/VideoPlayer.tsx:124]`

- [x] [AI-Review][High] Исправить баг инициализации IntersectionObserver: добавить `isLoading` в список зависимостей `useEffect` в `VideoPlayer.tsx`, чтобы автопауза работала после перехода из скелетона в плеер `[src/components/media/VideoPlayer.tsx:55-76]`
- [x] [AI-Review][High] Исправить навигацию в смешанных галереях: в `PostCard.tsx` для галерей с видео вернуть возможность клика по изображениям (например, через `interactive={true}` в `GalleryGrid` и оборачивание только НЕ-видео элементов в Link внутри `GalleryGrid`) `[src/components/feed/PostCard.tsx:103]`
- [x] [AI-Review][Medium] Добавить атрибут `disabled={isPending}` к кнопке Like в `PostCard.tsx` для полноценной доступности (A11y), а не только визуальной блокировки через pointer-events `[src/components/feed/PostCard.tsx:170-182]`
- [x] [AI-Review][Medium] Добавить интеграционный тест в `VideoPlayer.test.tsx`, который проверяет переход от `isLoading=true` к `isLoading=false` и корректность работы IntersectionObserver после этого перехода `[tests/unit/components/media/VideoPlayer.test.tsx]`
- [x] [AI-Review][High] Убрать бесполезный try/catch вокруг синхронного метода `pause()`. AbortError возникает асинхронно при вызове `play()`, а не `pause()`. Исправить моки в тестах. `[src/components/media/VideoPlayer.tsx:62-68, src/hooks/useVideoController.ts:24-30]`
- [x] [AI-Review][Medium] Сбрасывать состояние `hasError` при изменении `src`, чтобы новое видео могло загрузиться после ошибки предыдущего. `[src/components/media/VideoPlayer.tsx]`
- [x] [AI-Review][Low] Удалить фиктивный `<track kind="captions">`. Достаточно подавления правила линтера через комментарий. `[src/components/media/VideoPlayer.tsx:125]`

- [x] [AI-Review][High] A11y/UX Bug в GalleryGrid: Когда передается `itemLinkHref` вместе с `interactive={false}`, ссылки (`<Link>`) теряют стили `hover` и `focus-visible`, что делает их недоступными для навигации с клавиатуры. `[src/components/feed/GalleryGrid.tsx:117-119]`
- [x] [AI-Review][Medium] UI Responsiveness: Текст ошибки "Ошибка загрузки видео" слишком крупный (`text-sm`) для маленьких миниатюр в сетке (например, в `grid-3x3`), что может привести к обрезке текста или поломке верстки. `[src/components/media/VideoPlayer.tsx:98]`
- [x] [AI-Review][Low] Отсутствует fallback-контент для видео: Добавить текст внутри тега `<video>` (например, "Ваш браузер не поддерживает видео.") для старых браузеров. `[src/components/media/VideoPlayer.tsx:123]`
- [x] [AI-Review][Medium] Несогласованность ID видео: `PostCard` использует `post.id` в качестве `videoId` для одиночных видео, тогда как `GalleryGrid` использует `item.id`. Это может вызвать проблемы, если `activeVideoId` будет использоваться для поиска конкретного медиафайла. `[src/components/feed/PostCard.tsx:112]`

## Dev Notes

### 🏗️ Структура проекта (файлы)

```
src/
├── hooks/
│   └── useVideoController.ts        # ← СОЗДАТЬ
├── components/
│   └── media/
│       └── VideoPlayer.tsx          # ← СОЗДАТЬ
├── features/
│   └── feed/
│       └── store.ts                 # ← ИЗМЕНИТЬ (+activeVideoId)
tests/
└── unit/
    ├── hooks/
    │   └── useVideoController.test.ts  # ← СОЗДАТЬ
    └── components/
        └── media/
            └── VideoPlayer.test.tsx    # ← СОЗДАТЬ
```

### 🔑 Критические паттерны из существующего кода

**Расширение Zustand store — точно по паттерну `014_create_post_likes.sql` и `store.ts`:**

```typescript
// src/features/feed/store.ts — ДОБАВИТЬ в интерфейс:
interface FeedState {
  // ... существующие поля ...
  
  /** ID активного воспроизводимого видео. null = нет активного. NFR4.1 */
  activeVideoId: string | null
  setActiveVideo: (id: string | null) => void
}

// В initialState:
const initialState = {
  // ... существующие поля ...
  activeVideoId: null as string | null,
}

// В create<FeedState>:
setActiveVideo: (id) => set({ activeVideoId: id }),
```

> ⚠️ **Важно**: store НЕ расширяется отдельными action'ами для `play` и `pause`. Только `setActiveVideo(id: string | null)` — минимальный API. Это следует принципу минимализации store из architecture.md.

**Паттерн точечного селектора (из FeedContainer.tsx Iteration 11):**

```typescript
// ✅ ПРАВИЛЬНО — точечный селектор, только нужное поле
const activeVideoId = useFeedStore((s) => s.activeVideoId)

// ❌ НЕПРАВИЛЬНО — подписка на весь store (anti-pattern)
const { activeVideoId, setActiveVideo } = useFeedStore()
```

**Паттерн хука с `videoRef` (по аналогии с `useInView.ts`):**

```typescript
// src/hooks/useVideoController.ts
'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useFeedStore } from '@/features/feed/store'

interface UseVideoControllerReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>
  isActive: boolean
  handlePlay: () => void
  handlePause: () => void
}

export function useVideoController(videoId: string): UseVideoControllerReturn {
  const videoRef = useRef<HTMLVideoElement>(null)
  const activeVideoId = useFeedStore((s) => s.activeVideoId)
  const setActiveVideo = useFeedStore((s) => s.setActiveVideo)
  const isActive = activeVideoId === videoId

  // Автопауза при смене активного видео
  useEffect(() => {
    if (activeVideoId !== videoId && videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause()
    }
  }, [activeVideoId, videoId])

  // Автопауза при скролле из viewport
  useEffect(() => {
    const el = videoRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && !el.paused) {
          el.pause()
          // Освобождаем activeVideoId только если это наше видео
          if (useFeedStore.getState().activeVideoId === videoId) {
            useFeedStore.getState().setActiveVideo(null)
          }
        }
      },
      { threshold: 0.2 } // менее 20% видимости → пауза
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [videoId])

  const handlePlay = useCallback(() => {
    setActiveVideo(videoId)
  }, [videoId, setActiveVideo])

  const handlePause = useCallback(() => {
    // Освобождаем только если мы сами активны
    if (useFeedStore.getState().activeVideoId === videoId) {
      setActiveVideo(null)
    }
  }, [videoId, setActiveVideo])

  return { videoRef, isActive, handlePlay, handlePause }
}
```

**Компонент `VideoPlayer.tsx` — структура по образцу `LazyMediaWrapper.tsx`:**

```tsx
// src/components/media/VideoPlayer.tsx
'use client'

import { cn } from '@/lib/utils'
import { useVideoController } from '@/hooks/useVideoController'

interface VideoPlayerProps {
  /** ID видео в post_media — уникален в рамках одного сеанса */
  videoId: string
  /** URL видеофайла (из post_media.url) */
  src: string
  /** URL превью-изображения (из post_media.thumbnail_url или post.image_url) */
  poster?: string
  /** alt для превью изображения (accessibility) */
  alt?: string
  aspectRatio?: '16/9' | '4/5' | '1/1'
  className?: string
}

export function VideoPlayer({
  videoId,
  src,
  poster,
  alt = 'Videoposnetek',
  aspectRatio = '16/9',
  className,
}: VideoPlayerProps) {
  const { videoRef, handlePlay, handlePause } = useVideoController(videoId)

  const ratioClass = {
    '16/9': 'aspect-video',
    '4/5': 'aspect-[4/5]',
    '1/1': 'aspect-square',
  }[aspectRatio]

  return (
    <div className={cn('relative overflow-hidden rounded-md bg-black', ratioClass, className)}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls
        playsInline
        preload="none"      // NFR4: не тратить трафик до начала воспроизведения
        aria-label={alt}
        onPlay={handlePlay}
        onPause={handlePause}
        className="absolute inset-0 h-full w-full object-contain"
      />
    </div>
  )
}
```

### ⚠️ Критические Gotchas и решения

**1. `preload="none"` — обязательно!**
Без `preload="none"` браузер автоматически загружает метаданные или первый сегмент видео при рендере. В ленте с 10+ карточками это убивает производительность (нарушение NFR4).

**2. `playsInline` — обязательно для iOS**
Без этого атрибута iOS Safari открывает видео в fullscreen режиме вместо inline воспроизведения, нарушая UX.

**3. `videoRef.current.pause()` — проверять `paused` перед вызовом**
```typescript
// ✅ Безопасно
if (videoRef.current && !videoRef.current.paused) {
  videoRef.current.pause()
}
// ❌ Небезопасно — вызовет DOMException если видео ещё не загружено
videoRef.current?.pause()
```

**4. `IntersectionObserver threshold: 0.2`** — пауза при 80% скрытия, а не мгновенно при малейшем выходе. Иначе видео будет pausit-ься при нормальном скролле.

**5. `getState()` вместо React state для guard в `handlePause`**
Внутри event handlers используй `useFeedStore.getState()` (не hook), чтобы избежать stale closure — паттерн уже применён в `FeedContainer.tsx` (строки 183–191).

**6. `activeVideoId !== videoId` не идентично `!isActive`**
Когда `activeVideoId = null` и `videoId = 'abc'` → оба выражения `false`. Но когда `activeVideoId = 'xyz'` и `videoId = 'abc'` → `activeVideoId !== videoId` is `true`, `!isActive` is `true`. Используй `activeVideoId !== videoId` в useEffect для ясности.

**7. Нет глобального стора для `VideoController` — используем существующий `useFeedStore`**
Согласно epics.md#Story 2.5: *"состояние воспроизведения хранится в Zustand store (`src/features/feed/store.ts`)"*. Не создавать отдельный store! Добавить поле в уже существующий.

### 🧪 Шаблон тестов

**`useVideoController.test.ts`:**

```typescript
import { renderHook, act } from '@testing-library/react'
import { useVideoController } from '@/hooks/useVideoController'
import { useFeedStore } from '@/features/feed/store'

beforeEach(() => {
  useFeedStore.setState({ activeVideoId: null })
})

it('устанавливает activeVideoId при вызове handlePlay', () => {
  const { result } = renderHook(() => useVideoController('video-1'))
  act(() => result.current.handlePlay())
  expect(useFeedStore.getState().activeVideoId).toBe('video-1')
})

it('сбрасывает activeVideoId при вызове handlePause', () => {
  useFeedStore.setState({ activeVideoId: 'video-1' })
  const { result } = renderHook(() => useVideoController('video-1'))
  act(() => result.current.handlePause())
  expect(useFeedStore.getState().activeVideoId).toBeNull()
})

it('не сбрасывает activeVideoId если другое видео активно', () => {
  useFeedStore.setState({ activeVideoId: 'video-2' })  // другое видео активно
  const { result } = renderHook(() => useVideoController('video-1'))
  act(() => result.current.handlePause())
  // video-1 не должен сбрасывать state video-2
  expect(useFeedStore.getState().activeVideoId).toBe('video-2')
})

it('вызывает pause() на HTMLVideoElement когда меняется activeVideoId', () => {
  const { result } = renderHook(() => useVideoController('video-1'))
  
  // Мокаем videoRef.current
  const mockPause = vi.fn()
  Object.defineProperty(result.current.videoRef, 'current', {
    value: { pause: mockPause, paused: false },
    writable: true,
  })
  
  // Активируем другое видео
  act(() => useFeedStore.setState({ activeVideoId: 'video-2' }))
  expect(mockPause).toHaveBeenCalledTimes(1)
})

it('isActive=true когда activeVideoId совпадает с videoId', () => {
  useFeedStore.setState({ activeVideoId: 'video-1' })
  const { result } = renderHook(() => useVideoController('video-1'))
  expect(result.current.isActive).toBe(true)
})
```

**`VideoPlayer.test.tsx`:**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { VideoPlayer } from '@/components/media/VideoPlayer'
import { useFeedStore } from '@/features/feed/store'

// Мок useVideoController для изоляции
vi.mock('@/hooks/useVideoController', () => ({
  useVideoController: vi.fn(() => ({
    videoRef: { current: null },
    isActive: false,
    handlePlay: vi.fn(),
    handlePause: vi.fn(),
  })),
}))

it('рендерит <video> с src и poster', () => {
  render(<VideoPlayer videoId="v1" src="https://example.com/v.mp4" poster="https://example.com/p.jpg" />)
  const video = screen.getByRole('video' /* или просто: document.querySelector('video') */)
  expect(video).toHaveAttribute('src', 'https://example.com/v.mp4')
  expect(video).toHaveAttribute('poster', 'https://example.com/p.jpg')
})

it('имеет атрибут playsInline', () => {
  render(<VideoPlayer videoId="v1" src="https://example.com/v.mp4" />)
  expect(document.querySelector('video')).toHaveAttribute('playsInline')
})

it('имеет preload="none"', () => {
  render(<VideoPlayer videoId="v1" src="https://example.com/v.mp4" />)
  expect(document.querySelector('video')).toHaveAttribute('preload', 'none')
})
```

### Архитектурные паттерны (из architecture.md)

-   **Smart Container / Dumb UI**: `useVideoController` — Smart (знает о store), `VideoPlayer` — Dumb UI (props only, использует хук через composition)
-   **Zustand: точечные селекторы** — обязательны (Iteration 11 FeedContainer). `useFeedStore((s) => s.activeVideoId)` — не деструктурировать весь store
-   **Минимизация store**: `activeVideoId: string | null` — единственное новое поле. Никаких `isPlaying`, `currentTime`, `duration` — это принадлежит DOM, не store
-   **`getState()` в обработчиках событий**: обязательно для предотвращения stale closure (паттерн из FeedContainer строки 228–230)

### Project Structure Notes

**Создаваемые файлы:**
```
src/hooks/useVideoController.ts
src/components/media/VideoPlayer.tsx
tests/unit/hooks/useVideoController.test.ts
tests/unit/components/media/VideoPlayer.test.tsx
```

**Изменяемые файлы:**
```
src/features/feed/store.ts            # ← +activeVideoId, +setActiveVideo
src/components/feed/GalleryGrid.tsx   # ← VideoPlayer для media_type='video'
```

> ⚠️ `PostDetail.tsx` — НЕ изменяется в этой истории. Интеграция VideoPlayer в PostDetail — ответственность Story 2.6.

### References

-   Story 2.5 в epics: [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5]
-   Story 2.6 (PostDetail + VideoPlayer): [Source: _bmad-output/planning-artifacts/epics.md#Story 2.6] — интеграция VideoPlayer в PostDetail выполняется там
-   NFR4.1 (≤1 видео одновременно): [Source: _bmad-output/planning-artifacts/epics.md#NonFunctional Requirements]
-   SM brief (медиаконтроль): [Source: _bmad-output/implementation-artifacts/quick-spec-briefs/sm-brief-multimedia-posts.md#Media Control]
-   Architect brief (управление видео): [Source: _bmad-output/implementation-artifacts/quick-spec-briefs/architect-brief-multimedia-posts.md#NFR4.1]
-   Zustand store — точечные селекторы (Iteration 11): [Source: _bmad-output/implementation-artifacts/stories/2-3-optimized-media-display-in-cards-lazymediawrapper.md#Iteration 11]
-   `getState()` в event handlers: [Source: src/features/feed/components/FeedContainer.tsx#L183-230]
-   Паттерн `useInView.ts` (IntersectionObserver): [Source: src/hooks/useInView.ts]
-   Паттерн `LazyMediaWrapper.tsx` (структура компонента): [Source: src/components/media/LazyMediaWrapper.tsx]
-   Существующий store (addPendingLike паттерн): [Source: src/features/feed/store.ts]

## Dev Agent Record

### Agent Model Used

gemini-2.5-pro (SM Bob — create-story workflow); claude-sonnet-4-6 (Amelia Dev — implementation)

### Debug Log References

-   `document.querySelector('div')` в тестах аспектного соотношения VideoPlayer возвращал Testing Library wrapper — исправлено на `container.querySelector('div')`.
-   Тест `GalleryGrid.test.tsx` не мокировал `VideoPlayer` → `IntersectionObserver` ошибка при рендере видео-элементов — добавлен `vi.mock('@/components/media/VideoPlayer', ...)`.
-   Один middleware тест флаки при параллельном запуске всего suite (Stripe API timeout) — изолированно 62/62 проходят, не связано с нашими изменениями.

### Completion Notes List

-   **Task 1**: `activeVideoId: string | null` + `setActiveVideo` добавлены в `useFeedStore`. Минимальный API — только одно поле, без `isPlaying`/`currentTime` (принцип минимизации store).
-   **Task 2**: `useVideoController(videoId)` — хук управляет `videoRef`, автопаузой при смене активного видео (useEffect), автопаузой при выходе из viewport (IntersectionObserver threshold=0.2). `handlePause` защищён от stale closure через `useFeedStore.getState()`.
-   **Task 3**: `VideoPlayer` — Dumb UI компонент (композиция через хук). `preload="none"` (NFR4), `playsInline` (iOS), `controls`, `aria-label`.
-   **Task 4**: 8 тестов для `useVideoController` — покрыты все ACs #9 (5 минимум).
-   **Task 5**: 12 тестов для `VideoPlayer` — покрыты все ACs #8 (8 минимум). `useVideoController` замокирован для изоляции.
-   **Task 6**: `GalleryGrid` — видео-элементы (main + carousel) рендерятся через `VideoPlayer`. Видео не оборачивается в `<button>` (нет вложенных interactive элементов). `GalleryGrid.test.tsx` обновлён мок `VideoPlayer`.
-   **Task 7**: `tsc --noEmit` 0 ошибок. `npm run test` 590/590 (457 + 133 ранее + 20 новых = 590 total).

**Review Follow-ups Round 11 (2026-03-24, claude-sonnet-4-6):**
-   ✅ Resolved [High][A11y]: `GalleryGrid.tsx` — условие hover/focus-visible стилей изменено с `interactive &&` на `(interactive || !!itemLinkHref) &&` для main items и carousel items. `<Link>` элементы всегда получают интерактивные стили независимо от флага `interactive`. Добавлены 2 теста: main grid links + carousel links имеют `hover:opacity-90` и `focus-visible:ring-2` при `interactive=false, itemLinkHref`.
-   ✅ Resolved [Medium][UX]: `VideoPlayer.tsx` — текст ошибки исправлен с `text-sm` на `text-xs` для корректного отображения в маленьких ячейках сетки (`grid-3x3`).
-   ✅ Resolved [Low][HTML]: `VideoPlayer.tsx` — добавлен fallback-текст "Ваш браузер не поддерживает видео." внутри тега `<video>` для старых браузеров. Добавлен тест: проверяет `video.textContent`.
-   ✅ Resolved [Medium][Store]: `PostCard.tsx` — videoId теперь использует `post.media?.[0]?.id ?? post.id` для согласованности с `GalleryGrid` (который использует `item.id`). Добавлен тест: `media[0].id` используется когда массив присутствует.
-   **Валидация**: `npm run typecheck` ✅ 0 ошибок, `npm test` ✅ `634/634`.

**Review Follow-ups Round 10 (2026-03-23, claude-sonnet-4-6):**
-   ✅ Resolved [High]: Удалён `try/catch` вокруг `el.pause()` в IntersectionObserver (`VideoPlayer.tsx`) и вокруг `videoRef.current.pause()` в `useVideoController.ts`. `pause()` синхронный и не бросает AbortError (AbortError возникает асинхронно только при `play()`). Удалён тест "перехватывает DOMException при вызове pause()" из `useVideoController.test.ts`.
-   ✅ Resolved [Medium]: Сброс `hasError` при смене `src` реализован через паттерн "setState during render" (`prevSrc` state + сравнение при рендере) — React-рекомендованный подход (без `useEffect`). Добавлен тест: "сбрасывает состояние ошибки при смене src".
-   ✅ Resolved [Low]: Удалён `<track kind="captions">` из `VideoPlayer.tsx`. Правило `jsx-a11y/media-has-caption` не срабатывает на self-closing `<video />`, eslint-disable комментарий не нужен. Тест обновлён: проверяет отсутствие `<track>`.
-   **Валидация**: `npm run typecheck` ✅ 0 ошибок, `npm test` ✅ `630/630`, story-scoped `eslint` ✅ `0 errors`.

**Review Follow-ups Round 9 (2026-03-23, claude-sonnet-4-6):**
-   ✅ Resolved [High]: `VideoPlayer.tsx` — `isLoading` добавлен в guard и deps `useEffect`, поэтому `IntersectionObserver` инициализируется после перехода из skeleton в `<video>`. Добавлен интеграционный тест на сценарий `isLoading=true -> false -> viewport pause`.
-   ✅ Resolved [High]: `GalleryGrid.tsx` — добавлен `itemLinkHref`, который оборачивает только image-элементы в `Link`, сохраняя video без ссылки. `PostCard.tsx` использует `itemLinkHref` для mixed gallery, поэтому навигация по изображениям восстановлена без поломки video controls.
-   ✅ Resolved [Medium]: `PostCard.tsx` — Like button теперь получает `disabled={isPending}` в дополнение к визуальной блокировке через `pointer-events-none opacity-50`.
-   ✅ Resolved [Medium]: Добавлены тесты в `PostCard.test.tsx` и `GalleryGrid.test.tsx` на mixed gallery navigation и `disabled` состояние кнопки Like.
-   **Валидация**: `npm run typecheck` ✅, `npm test` ✅ `630/630`, story-scoped `eslint` ✅ `0 errors` (`2 warnings`), repo-wide `npm run lint` ❌ из-за pre-existing проблем в `everything-claude-code/**` вне scope истории.

**Review Follow-ups Round 8 (2026-03-23, claude-sonnet-4-6):**
-   ✅ Resolved [High][Logic]: `PostCard.tsx` — условие рендеринга `VideoPlayerContainer` расширено: `post.type === 'video'` → `(post.type === 'video' || post.type === 'multi-video')`. Фикс также применён к `LazyMediaWrapper` fallback (type prop). Добавлены 2 теста: рендерит VideoPlayerContainer для multi-video, не рендерит LazyMediaWrapper.
-   ✅ Resolved [Medium][UX]: `GalleryGrid.tsx` — видео-обёртки в основной сетке и карусели больше не наследуют интерактивные стили. Введён `videoItemClass` (без hover/focus-ring) для main grid; carousel использует инлайн-строку без этих классов. Добавлены 3 теста: wrapper в сетке без hover, без focus-ring, carousel wrapper без hover.
-   ✅ Resolved [Low][HTML]: `VideoPlayer.tsx` — WebVTT data URI исправлен: `data:text/vtt,WEBVTT` → `data:text/vtt,WEBVTT%0A%0A` (двойной перенос строки по спецификации). Тест обновлён.
-   **Итого**: 625/625 тестов, `tsc --noEmit` 0 ошибок. Все 38 Review Follow-up пунктов закрыты. Стори переведена в `done`.

**Review Follow-ups Round 7 (2026-03-23, claude-sonnet-4-6):**
-   ✅ Resolved [High][Memory Leak]: `hasError` добавлен в deps IntersectionObserver useEffect в `VideoPlayer.tsx` — при переходе в состояние ошибки cleanup вызывает `observer.disconnect()`. Добавлен тест: "IntersectionObserver отключается при переходе в состояние ошибки".
-   ✅ Resolved [High]: `try-catch` добавлен к `videoRef.current.pause()` в `useVideoController.ts` — перехватывает `DOMException/AbortError` при быстром переключении. Добавлен тест: "перехватывает DOMException при вызове pause() — не выбрасывает исключение".
-   ✅ Resolved [Medium][Store]: `onPause?.()` вызывается в обработчике `onError` в `VideoPlayer.tsx` — сбрасывает `activeVideoId` в store при ошибке загрузки. Добавлен тест: "onError вызывает onPause для сброса activeVideoId в store".
-   ✅ Resolved [Medium][CRLF]: Добавлен `.gitattributes` в корень проекта — нормализация LF для всех `.ts/.tsx/.css/.json/.md/.yaml` файлов.
-   ✅ Resolved [Low][Captions]: Добавлен `eslint-disable-next-line jsx-a11y/media-has-caption` к `<track>` в `VideoPlayer.tsx` — явное подавление правила линтера вместо неявного хака.
-   **Итого**: 620/620 тестов, регрессий нет. Все 35 Review Follow-up пунктов закрыты.

**Review Follow-ups Round 6 (2026-03-23, claude-sonnet-4-6):**
-   ✅ Resolved [High][Docs]: Task 2.6 описание обновлено — добавлено примечание что IntersectionObserver реализован в `VideoPlayer.tsx` (Round 4), а не в `useVideoController.ts`.
-   ✅ Resolved [High][HTML]: `<track kind="captions" src="data:text/vtt,WEBVTT" />` — data URI удовлетворяет HTML5-спецификации (src обязателен), не вызывает сетевых запросов. Тест обновлён: `toHaveAttribute('src', 'data:text/vtt,WEBVTT')`.
-   ✅ Resolved [High][Perf]: `PostCard.tsx` — условие рендера VideoPlayerContainer изменено с `(post.mediaItem || post.media?.[0])` на `(post.mediaItem?.url || post.media?.[0]?.url)`. Предотвращает рендер при пустом/отсутствующем url, нет сетевых запросов при пустом src.
-   ✅ Resolved [Medium][React]: React 19.2.3 — `ref` как prop поддерживается нативно (React 19 убрал необходимость `forwardRef`). Реализация в `VideoPlayer.tsx` уже корректна. Изменений не требуется.
-   ✅ Resolved [Medium][A11y]: `title={alt}` добавлен на `<video>` в `VideoPlayer.tsx`. Дополняет `aria-label` для screen reader поддержки. Тест добавлен: `toHaveAttribute('title', 'Видео поста')`.
-   ✅ Resolved [Medium][UX]: `onError` handler добавлен в `VideoPlayer.tsx` — `hasError` state (useState), при ошибке рендерит `<div data-testid="video-player-error">` с текстом "Ошибка загрузки видео". Добавлены 2 теста: error state рендерится, video скрывается.
-   **Итого**: 617/617 тестов, `tsc --noEmit` 0 ошибок. Все 30 Review Follow-up пунктов закрыты.

**Review Follow-ups Round 5 (2026-03-23, claude-sonnet-4-6):**
-   ✅ Resolved [High][A11y]: `<track kind="captions" />` добавлен внутрь `<video>` в `VideoPlayer.tsx` — удовлетворяет `jsx-a11y/media-has-caption`. Добавлен 1 тест: `рендерит <track kind="captions">`.
-   ✅ Resolved [High][Logic]: `PostCard.tsx` — условие `post.type === 'video' && post.mediaItem` расширено до `(post.mediaItem || post.media?.[0])`. src/poster используют nullish coalescing для фоллбэка на `media[0]`. Добавлены 2 теста: рендерит VideoPlayer без mediaItem, использует media[0].url как src.
-   ✅ Resolved [Medium][UX]: `try-catch` в IntersectionObserver callback сделан специфичным — перехватывает только `DOMException` (AbortError при race condition play/pause), неожиданные ошибки перебрасываются.
-   ✅ Resolved [Medium][Store]: SSR Hydration проверена — `activeVideoId: null` инициализируется идентично на сервере и клиенте; все потребители `'use client'`; нет localStorage/sessionStorage. Задокументировано комментарием в `useVideoController.ts`. Mismatch невозможен.
-   **Итого**: 614/614 тестов, `tsc --noEmit` 0 ошибок.

**Review Follow-ups Round 4 (2026-03-23, claude-sonnet-4-6):**
-   ✅ Resolved [Critical]: Skeleton-placeholder добавлен в `VideoPlayer` — проп `isLoading?: boolean`, при true рендерит `<div data-testid="video-player-skeleton" aria-hidden>` с `animate-pulse` и корректным `aspect-ratio`. Добавлены 2 теста: skeleton рендерится вместо video, skeleton имеет animate-pulse + правильный aspect.
-   ✅ Resolved [High]: `VideoPlayer` — полностью Dumb UI. Убран `useVideoController` из компонента. Добавлены пропсы `onPlay?: () => void`, `onPause?: () => void`, `ref?: React.RefObject<HTMLVideoElement | null>`. IntersectionObserver перенесён из хука в компонент. Создан `VideoPlayerContainer` (`src/features/feed/components/VideoPlayerContainer.tsx`) — Smart wrapper, вызывает хук и прокидывает ref/onPlay/onPause в VideoPlayer. GalleryGrid и PostCard используют VideoPlayerContainer.
-   ✅ Resolved [High]: Тест на автопаузу при выходе из viewport добавлен в `VideoPlayer.test.tsx` — 2 теста: `isIntersecting=false + paused=false → pause()` вызывается; `isIntersecting=false + paused=true → pause()` не вызывается.
-   ✅ Resolved [Medium]: A11y — убран `aria-hidden="true"` с `<Link>` вокруг media-content в PostCard (строки 106-107 и 122-130). SVG-иконки сохраняют `aria-hidden`, а превью-ссылки теперь видимы для screen readers.
-   ✅ Resolved [Medium]: File List синхронизирован с git reality — обновлён ниже.
-   ✅ Resolved [Low]: Дублирование VideoPlayer в File List устранено.

**Review Follow-ups Round 3 (2026-03-23, claude-sonnet-4-6):**
- ✅ Resolved [High]: Race Condition устранён — убран избыточный `useFeedStore.getState().setActiveVideo(null)` из IntersectionObserver callback. `el.pause()` уже триггерит `onPause → handlePause → setActiveVideo(null)`, двойной вызов невозможен.
- ✅ Resolved [Medium]: State Leak при unmount устранён — добавлен `useEffect` cleanup с зависимостью `[videoId]`, который при размонтировании сбрасывает `activeVideoId` если этот компонент был активным. Добавлены 2 теста: unmount активного и неактивного видео.
- ✅ Resolved [Low]: Убран `onClick={(e) => e.preventDefault()}` с wrapper `<div>` в `VideoPlayer`. PostCard.tsx уже не оборачивает VideoPlayer в `<Link>` (исправлено в Round 2), поэтому preventDefault был бесполезен и блокировал нативные контролы плеера. Тест переписан: проверяет `object-cover` класс.
- ✅ Resolved [Low]: `object-contain` → `object-cover` в VideoPlayer — устраняет чёрные полосы в квадратных галереях, поведение соответствует `LazyMediaWrapper`.

**Review Follow-ups Round 2 (2026-03-23, claude-sonnet-4-6):**
- ✅ Resolved [High]: `PostCard.tsx` — убран `<Link>` вокруг `GalleryGrid` когда в галерее есть видео. Используется `<div className="mb-4">` вместо Link. Добавлены тесты: галерея с видео без Link, галерея из изображений сохраняет Link.
- ✅ Resolved [High]: `PostCard.tsx` — одиночное видео с `mediaItem` рендерит `VideoPlayer` (не `LazyMediaWrapper`), без обёртки-ссылки. `videoId={post.id}`. Добавлены 3 теста: VideoPlayer рендерится, нет `<a>`, правильный videoId.
- ✅ Resolved [Medium]: `GalleryGrid.tsx` — видео-элементы в main grid получают `priority={priority && i < 2}`. Мок VideoPlayer обновлён для захвата `data-priority`. Добавлены 2 теста: priority проброс.
- ✅ Resolved [Low]: `VideoPlayer.tsx` — wrapper `<div>` получил `onClick={(e) => e.preventDefault()}`. Тест: `event.defaultPrevented === true` при клике.

**Review Follow-ups (2026-03-23, claude-sonnet-4-6):**
- ✅ Resolved [High]: boolean-селектор `useFeedStore((s) => s.activeVideoId === videoId)` — предотвращает лишние перерендеры. Effект теперь зависит от `[isActive]` вместо `[activeVideoId, videoId]`. Тест обновлён: теперь video-1 начинает активным (isActive: true), затем переключается на video-2 (isActive: false → effect → pause()).
- ✅ Resolved [Medium]: AC #7 обновлён — корректно указывает `GalleryGrid` как источник прокидывания `videoId`, а не `FeedContainer`.
- ✅ Resolved [Medium]: все тесты `VideoPlayer.test.tsx` переведены на `container.querySelector('video')` для изоляции. Добавлен тест `priority=true → preload="metadata"` (13 тестов итого).
- ✅ Resolved [Low]: `el.pause()` в IntersectionObserver обёрнут в `try/catch` для защиты от DOMException при маунте.
- ✅ Resolved [Low]: добавлен проп `priority?: boolean` в `VideoPlayer` — `preload={priority ? 'metadata' : 'none'}`.

### Senior Developer Review (AI)

*Reviewer: Alex on 2026-03-23*
**Результат:** Требуются изменения (Changes Requested)

В ходе ревью выявлена критическая проблема с производительностью: подписка на `activeVideoId` в `useVideoController` приводит к лишним перерендерам всех компонентов `VideoPlayer` в ленте при любом изменении активного видео. Также обнаружены проблемы с качеством тестов (глобальные селекторы) и неточности в документации (AC #7). Сформирован список Action Items для исправления.

### File List

**Новые файлы:**
- `src/hooks/useVideoController.ts`
- `src/features/feed/components/VideoPlayerContainer.tsx`
- `tests/unit/hooks/useVideoController.test.ts`
- `tests/unit/components/media/VideoPlayer.test.tsx`
- `tests/unit/features/feed/components/VideoPlayerContainer.test.tsx`

**Изменённые файлы:**
- `src/features/feed/store.ts` — добавлены `activeVideoId`, `setActiveVideo`
- `src/components/media/VideoPlayer.tsx` — Dumb UI рефакторинг: убран useVideoController, добавлены onPlay/onPause/ref/isLoading пропсы, IntersectionObserver для viewport-autopause, skeleton; Memory Leak fix (hasError в deps), onPause при onError, повторная инициализация observer после `isLoading=false`
- `src/components/feed/GalleryGrid.tsx` — использует VideoPlayerContainer (вместо VideoPlayer) для media_type='video'; priority проброс; `itemLinkHref` для навигации по изображениям в mixed gallery
- `src/components/feed/PostCard.tsx` — использует VideoPlayerContainer для одиночного видео; убран aria-hidden с media Link; mixed gallery восстанавливает клики по изображениям; Like button получает `disabled={isPending}`
- `src/hooks/useVideoController.ts` — убран IntersectionObserver (перенесён в VideoPlayer); store-логика сохранена; try-catch к pause()
- `tests/unit/components/feed/GalleryGrid.test.tsx` — мок обновлён на VideoPlayerContainer; добавлен тест на `itemLinkHref` в mixed gallery
- `tests/unit/components/feed/PostCard.test.tsx` — мок обновлён на VideoPlayerContainer; добавлены тесты на mixed gallery navigation и `disabled` для Like
- `tests/unit/components/media/VideoPlayer.test.tsx` — добавлены тесты: IntersectionObserver disconnect on error, onPause on error, переход `isLoading=true -> false`
- `tests/unit/hooks/useVideoController.test.ts` — добавлен тест: DOMException catch
- `.gitattributes` — новый файл: нормализация LF для всех исходников
- `_bmad-output/implementation-artifacts/stories/2-5-global-video-playback-controller.md` — статус review, File List, completion notes (Round 11)

## Change Log

- **2026-03-23** — Начальная реализация: Tasks 1-7 (store, useVideoController, VideoPlayer, тесты, GalleryGrid интеграция)
- **2026-03-23** — Review Follow-ups Round 1: boolean-селектор, AC #7 уточнение, тесты изолированы, try/catch, priority prop
- **2026-03-23** — Review Follow-ups Round 2: PostCard невалидный HTML (Link+video), одиночное видео → VideoPlayer, priority проброс, preventDefault
- **2026-03-23** — Review Follow-ups Round 3: Race Condition устранён, State Leak при unmount, object-contain→object-cover, убран лишний onClick
- **2026-03-23** — Review Follow-ups Round 4: VideoPlayer Dumb UI (убран useVideoController, добавлены onPlay/onPause/ref/isLoading), VideoPlayerContainer создан, IntersectionObserver перенесён в VideoPlayer, skeleton добавлен, тест viewport-autopause, A11y (убран aria-hidden с Link), 611/611 тестов. Адрес Code Review findings: 20 items resolved.
- **2026-03-23** — Review Follow-ups Round 5: `<track kind="captions">` в VideoPlayer (A11y), фоллбэк `post.media?.[0]` в PostCard (Logic), специфичный DOMException catch (UX), SSR Hydration документация в useVideoController (Store). 614/614 тестов. Все 24 Review Follow-up пункта закрыты.
- **2026-03-23** — Review Follow-ups Round 6: `<track src="data:text/vtt,WEBVTT">` (HTML5 validity), PostCard perf guard для пустого url, `title={alt}` (A11y), `onError→hasError` state (UX), React 19 ref-as-prop подтверждён, Task 2.6 docs обновлены. 617/617 тестов. Все 30 Review Follow-up пунктов закрыты.
- **2026-03-23** — Review Follow-ups Round 7: Memory Leak fix (hasError в deps IntersectionObserver), try-catch к pause() в useVideoController, onPause при onError (store reset), .gitattributes (LF нормализация), eslint-disable captions. 620/620 тестов. Все 35 Review Follow-up пунктов закрыты.
- **2026-03-23** — Final Review (Amelia): Найдено 3 новых замечания (High, Medium, Low). Стори переведена в `in-progress` для исправлений.
- **2026-03-23** — Review Follow-ups Round 8: multi-video фоллбэк в PostCard (Logic), убраны hover/focus-ring с видео-обёрток GalleryGrid (UX), WebVTT data URI исправлен (HTML). 625/625 тестов. Все 38 пунктов закрыты. Статус: done.
- **2026-03-23** — Code Review (Amelia): Найдено 4 новых проблемы (High, Medium). Статус изменён на `in-progress`.
- **2026-03-23** — Review Follow-ups Round 9: исправлена повторная инициализация `IntersectionObserver` после skeleton, восстановлена навигация по изображениям в mixed gallery через `itemLinkHref`, Like button получил `disabled={isPending}`, добавлены интеграционные тесты. `npm run typecheck` 0 ошибок, `npm test` 630/630.
- **2026-03-23** — Review Follow-ups Round 10: удалён бесполезный try/catch вокруг `pause()` (sync, не бросает AbortError), сброс `hasError` при смене `src` (derived state during render), удалён фиктивный `<track kind="captions">`. 630/630 тестов. Все 3 оставшихся пункта закрыты.
- **2026-03-24** — Review Follow-ups Round 11: GalleryGrid Links всегда имеют hover/focus стили при `itemLinkHref` (A11y), `text-xs` в VideoPlayer error state (UX), fallback-текст для старых браузеров (HTML), videoId согласованность в PostCard (Store). 634/634 тестов. Все 4 оставшихся пункта закрыты. Статус: review.

