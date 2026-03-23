# Story 2.5: Глобальный менеджер воспроизведения видео (Video Controller)

Status: ready-for-dev

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

7. **`FeedContainer` как Smart Container**: `FeedContainer` (`src/features/feed/components/FeedContainer.tsx`) управляет логикой контроля видео при скролле — прокидывает `videoId` в `VideoPlayer` внутри карточек ленты. `VideoPlayer` сам через `useVideoController` взаимодействует со store.

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

- [ ] **Task 1: Расширить Zustand store новым состоянием видео** (AC: #2)
  - [ ] 1.1. Добавить `activeVideoId: string | null` в `FeedState` интерфейс в `src/features/feed/store.ts`
  - [ ] 1.2. Добавить `setActiveVideo: (id: string | null) => void` action
  - [ ] 1.3. Добавить `activeVideoId: null` в `initialState`
  - [ ] 1.4. Реализовать `setActiveVideo` через `set({ activeVideoId: id })`

- [ ] **Task 2: Создать хук `useVideoController`** (AC: #4, #5)
  - [ ] 2.1. Создать файл `src/hooks/useVideoController.ts`
  - [ ] 2.2. Хук принимает `videoId: string` и возвращает `{ videoRef: RefObject<HTMLVideoElement>, isActive: boolean }`
  - [ ] 2.3. Подписаться на `activeVideoId` из store через точечный селектор
  - [ ] 2.4. `useEffect([activeVideoId])`: если `activeVideoId !== videoId && videoRef.current` → вызвать `.pause()`
  - [ ] 2.5. Экспортировать `handlePlay` / `handlePause` коллбэки для передачи в `VideoPlayer`
  - [ ] 2.6. Реализовать автопаузу при выходе из viewport через `IntersectionObserver` (переиспользовать паттерн из `useInView.ts`)

- [ ] **Task 3: Создать компонент `VideoPlayer`** (AC: #3, #7)
  - [ ] 3.1. Создать файл `src/components/media/VideoPlayer.tsx` (`'use client'`)
  - [ ] 3.2. Определить `VideoPlayerProps` (см. Dev Notes)
  - [ ] 3.3. Использовать `useVideoController(videoId)` для управления паузой
  - [ ] 3.4. Рендерить нативный `<video>` с пропами `src`, `poster`, `controls`, `playsInline`
  - [ ] 3.5. Прокидывать `onPlay={handlePlay}`, `onPause={handlePause}` из хука в `<video>`
  - [ ] 3.6. Обернуть в `<div>` с aspect-ratio и `overflow-hidden` (паттерн из `LazyMediaWrapper`)
  - [ ] 3.7. Добавить skeleton-placeholder аналогично `LazyMediaWrapper`

- [ ] **Task 4: Написать тесты для `useVideoController`** (AC: #9)
  - [ ] 4.1. Создать `tests/unit/hooks/useVideoController.test.ts`
  - [ ] 4.2. Написать 5+ тестов (детали в Dev Notes)

- [ ] **Task 5: Написать тесты для `VideoPlayer`** (AC: #8)
  - [ ] 5.1. Создать `tests/unit/components/media/VideoPlayer.test.tsx`
  - [ ] 5.2. Написать 8+ тестов (детали в Dev Notes)

- [ ] **Task 6: Интегрировать `VideoPlayer` в `GalleryGrid`** (AC: #6)
  - [ ] 6.1. В `src/components/feed/GalleryGrid.tsx`: для элементов с `media_type='video'` — рендерить `VideoPlayer` вместо статичного `LazyMediaWrapper`
  - [ ] 6.2. Использовать `videoId={media.id}` из `PostMedia.id` как уникальный идентификатор

  > ⚠️ Интеграция `VideoPlayer` в `PostDetail` — Task Story 2.6 (вне scope).

- [ ] **Task 7: Верификация** (AC: #10)
  - [ ] 7.1. `npx tsc --noEmit` → 0 ошибок
  - [ ] 7.2. Запустить все тесты → регрессий нет

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

- **Smart Container / Dumb UI**: `useVideoController` — Smart (знает о store), `VideoPlayer` — Dumb UI (props only, использует хук через composition)
- **Zustand: точечные селекторы** — обязательны (Iteration 11 FeedContainer). `useFeedStore((s) => s.activeVideoId)` — не деструктурировать весь store
- **Минимизация store**: `activeVideoId: string | null` — единственное новое поле. Никаких `isPlaying`, `currentTime`, `duration` — это принадлежит DOM, не store
- **`getState()` в обработчиках событий**: обязательно для предотвращения stale closure (паттерн из FeedContainer строки 228–230)

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

- Story 2.5 в epics: [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5]
- Story 2.6 (PostDetail + VideoPlayer): [Source: _bmad-output/planning-artifacts/epics.md#Story 2.6] — интеграция VideoPlayer в PostDetail выполняется там
- NFR4.1 (≤1 видео одновременно): [Source: _bmad-output/planning-artifacts/epics.md#NonFunctional Requirements]
- SM brief (медиаконтроль): [Source: _bmad-output/implementation-artifacts/quick-spec-briefs/sm-brief-multimedia-posts.md#Media Control]
- Architect brief (управление видео): [Source: _bmad-output/implementation-artifacts/quick-spec-briefs/architect-brief-multimedia-posts.md#NFR4.1]
- Zustand store — точечные селекторы (Iteration 11): [Source: _bmad-output/implementation-artifacts/stories/2-3-optimized-media-display-in-cards-lazymediawrapper.md#Iteration 11]
- `getState()` в event handlers: [Source: src/features/feed/components/FeedContainer.tsx#L183-230]
- Паттерн `useInView.ts` (IntersectionObserver): [Source: src/hooks/useInView.ts]
- Паттерн `LazyMediaWrapper.tsx` (структура компонента): [Source: src/components/media/LazyMediaWrapper.tsx]
- Существующий store (addPendingLike паттерн): [Source: src/features/feed/store.ts]

## Dev Agent Record

### Agent Model Used

gemini-2.5-pro (SM Bob — create-story workflow)

### Debug Log References

### Completion Notes List

### File List
