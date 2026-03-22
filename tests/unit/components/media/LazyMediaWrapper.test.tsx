import { render, fireEvent, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { LazyMediaWrapper } from '@/components/media/LazyMediaWrapper'
import { _resetSharedObserver } from '@/hooks/useInView'

vi.mock('next/image', () => ({
  default: ({
    alt,
    src,
    className,
    onLoad,
    onError,
  }: {
    alt?: string
    src?: string
    className?: string
    onLoad?: () => void
    onError?: () => void
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt ?? ''} src={src} className={className} onLoad={onLoad} onError={onError} />
  ),
}))

const observeMock = vi.fn()
const unobserveMock = vi.fn()
const disconnectMock = vi.fn()

// Один разделяемый callback — имитирует shared IntersectionObserver из useInView.ts
let capturedCallback: IntersectionObserverCallback | undefined

class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    capturedCallback = callback
  }

  observe = observeMock
  unobserve = unobserveMock
  disconnect = disconnectMock
}

beforeEach(() => {
  // Стабим глобал ДО сброса синглтона — чтобы следующий getSharedObserver()
  // создал экземпляр через наш мок, а не через предыдущий стаб
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
  _resetSharedObserver()
  capturedCallback = undefined
  observeMock.mockClear()
  unobserveMock.mockClear()
  disconnectMock.mockClear()
})

afterEach(() => {
  // Восстанавливаем оригинальный глобал после каждого теста
  vi.unstubAllGlobals()
  // Сбрасываем синглтон чтобы следующий beforeEach начал чисто
  _resetSharedObserver()
})

describe('LazyMediaWrapper', () => {
  describe('отложенная загрузка (AC 1)', () => {
    it('вызывает observe на контейнере при priority=false (по умолчанию)', () => {
      const { container } = render(
        <LazyMediaWrapper src="https://example.com/image.jpg" alt="Test" />
      )
      const wrapper = container.firstChild as HTMLElement

      expect(observeMock).toHaveBeenCalledTimes(1)
      expect(observeMock).toHaveBeenCalledWith(wrapper)
    })

    it('не вызывает observe при priority=true', () => {
      render(<LazyMediaWrapper src="https://example.com/image.jpg" alt="Test" priority />)
      expect(observeMock).not.toHaveBeenCalled()
    })

    it('создаёт IntersectionObserver с rootMargin 200px', () => {
      let capturedOptions: IntersectionObserverInit | undefined

      // Заменяем стаб локальным классом, захватывающим опции
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          constructor(cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) {
            capturedCallback = cb
            capturedOptions = opts
          }
          observe = observeMock
          unobserve = unobserveMock
          disconnect = disconnectMock
        }
      )
      // Сбрасываем синглтон, чтобы новый стаб вступил в силу
      _resetSharedObserver()

      render(<LazyMediaWrapper src="https://example.com/image.jpg" alt="Test" />)

      expect(capturedOptions?.rootMargin).toBe('200px')
    })

    it('не рендерит изображение до пересечения viewport', () => {
      const { queryByRole } = render(
        <LazyMediaWrapper src="https://example.com/image.jpg" alt="Lazy image" />
      )
      expect(queryByRole('img')).toBeNull()
    })

    it('корректно обрабатывает несколько экземпляров через один shared observer', () => {
      const { container: c1 } = render(
        <LazyMediaWrapper src="https://example.com/img1.jpg" alt="First" />
      )
      const { container: c2 } = render(
        <LazyMediaWrapper src="https://example.com/img2.jpg" alt="Second" />
      )

      // Оба элемента зарегистрированы через один и тот же IO
      expect(observeMock).toHaveBeenCalledTimes(2)
      expect(observeMock).toHaveBeenCalledWith(c1.firstChild)
      expect(observeMock).toHaveBeenCalledWith(c2.firstChild)
    })
  })

  describe('управление ресурсами обсервера', () => {
    it('вызывает unobserve при анмаунте компонента (enabled=true → cleanup)', () => {
      const { container, unmount } = render(
        <LazyMediaWrapper src="https://example.com/image.jpg" alt="Test" />
      )
      const wrapper = container.firstChild as HTMLElement

      expect(observeMock).toHaveBeenCalledWith(wrapper)

      unmount()

      expect(unobserveMock).toHaveBeenCalledWith(wrapper)
    })

    it('вызывает disconnect когда анмаунтится последний наблюдаемый компонент', () => {
      const { unmount: u1 } = render(
        <LazyMediaWrapper src="https://example.com/img1.jpg" alt="First" />
      )
      const { unmount: u2 } = render(
        <LazyMediaWrapper src="https://example.com/img2.jpg" alt="Second" />
      )

      expect(observeMock).toHaveBeenCalledTimes(2)

      // Анмаунт первого — registry ещё не пуст, disconnect не вызывается
      u1()
      expect(disconnectMock).not.toHaveBeenCalled()

      // Анмаунт последнего — registry пуст, disconnect освобождает ресурсы
      u2()
      expect(disconnectMock).toHaveBeenCalledTimes(1)
    })

    it('не вызывает disconnect при анмаунте одного из нескольких компонентов', () => {
      const { unmount: u1 } = render(
        <LazyMediaWrapper src="https://example.com/img1.jpg" alt="First" />
      )
      render(<LazyMediaWrapper src="https://example.com/img2.jpg" alt="Second" />)
      render(<LazyMediaWrapper src="https://example.com/img3.jpg" alt="Third" />)

      u1()

      expect(disconnectMock).not.toHaveBeenCalled()
      expect(unobserveMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('плейсхолдер и пропорции (AC 2)', () => {
    it('показывает класс animate-pulse до загрузки изображения', () => {
      const { container } = render(
        <LazyMediaWrapper src="https://example.com/image.jpg" alt="Test" />
      )
      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.className).toContain('animate-pulse')
    })

    it('применяет aspect-video для соотношения 16/9', () => {
      const { container } = render(
        <LazyMediaWrapper src="https://example.com/image.jpg" alt="Test" aspectRatio="16/9" />
      )
      expect((container.firstChild as HTMLElement).className).toContain('aspect-video')
    })

    it('применяет aspect-[4/5] для соотношения 4/5', () => {
      const { container } = render(
        <LazyMediaWrapper src="https://example.com/image.jpg" alt="Test" aspectRatio="4/5" />
      )
      expect((container.firstChild as HTMLElement).className).toContain('aspect-[4/5]')
    })

    it('применяет aspect-square для соотношения 1/1', () => {
      const { container } = render(
        <LazyMediaWrapper src="https://example.com/image.jpg" alt="Test" aspectRatio="1/1" />
      )
      expect((container.firstChild as HTMLElement).className).toContain('aspect-square')
    })
  })

  describe('приоритетная загрузка', () => {
    it('рендерит изображение сразу при priority=true (isInView=true без observer)', () => {
      const { getByRole } = render(
        <LazyMediaWrapper src="https://example.com/image.jpg" alt="Priority image" priority />
      )
      expect(getByRole('img', { name: 'Priority image' })).toBeTruthy()
    })
  })

  describe('обработка видео (AC 4)', () => {
    it('не показывает иконку воспроизведения до загрузки изображения (при priority=true)', () => {
      const { container } = render(
        <LazyMediaWrapper
          src="https://example.com/thumb.jpg"
          alt="Video"
          type="video"
          priority
        />
      )
      // SVG с иконкой play появляется только после onLoad — до загрузки его нет
      const playIcon = container.querySelector('svg path[d="M8 5v14l11-7z"]')
      expect(playIcon).toBeNull()
    })
  })

  describe('обработка ошибок загрузки onError (AC 1)', () => {
    it('убирает animate-pulse после onError (priority=true)', () => {
      const { container, getByRole } = render(
        <LazyMediaWrapper src="https://example.com/broken.jpg" alt="Broken" priority />
      )
      const wrapper = container.firstChild as HTMLElement

      expect(wrapper.className).toContain('animate-pulse')

      fireEvent.error(getByRole('img', { name: 'Broken' }))

      expect(wrapper.className).not.toContain('animate-pulse')
    })

    it('показывает fallback-элемент после onError', () => {
      const { container, getByRole } = render(
        <LazyMediaWrapper src="https://example.com/broken.jpg" alt="Fallback" priority />
      )

      fireEvent.error(getByRole('img', { name: 'Fallback' }))

      expect(container.querySelector('[data-testid="media-error-fallback"]')).toBeTruthy()
    })

    it('убирает animate-pulse после onError при lazy-загрузке (priority=false)', () => {
      const { container } = render(
        <LazyMediaWrapper src="https://example.com/broken.jpg" alt="Lazy broken" />
      )
      const wrapper = container.firstChild as HTMLElement

      act(() => {
        capturedCallback?.(
          [{ isIntersecting: true, target: wrapper } as unknown as IntersectionObserverEntry],
          {} as IntersectionObserver
        )
      })

      const img = container.querySelector('img')!
      fireEvent.error(img)

      expect(wrapper.className).not.toContain('animate-pulse')
      expect(container.querySelector('[data-testid="media-error-fallback"]')).toBeTruthy()
    })
  })

  describe('доступность fallback при ошибке (a11y AC 2)', () => {
    it('error fallback имеет role="img" и aria-label для screen reader', () => {
      const { container, getByRole } = render(
        <LazyMediaWrapper src="https://example.com/broken.jpg" alt="Описание медиа" priority />
      )
      fireEvent.error(getByRole('img', { name: 'Описание медиа' }))
      const fallback = container.querySelector('[data-testid="media-error-fallback"]')
      expect(fallback).toHaveAttribute('role', 'img')
      expect(fallback).toHaveAttribute('aria-label', 'Описание медиа')
    })
  })

  describe('сброс состояния при смене src', () => {
    it('сбрасывает isLoaded при смене src — скелетон появляется снова', () => {
      const { container, getByRole, rerender } = render(
        <LazyMediaWrapper src="https://example.com/image1.jpg" alt="Test" priority />
      )

      fireEvent.load(getByRole('img', { name: 'Test' }))
      // До смены src — animate-pulse снят (загружено)
      expect((container.firstChild as HTMLElement).className).not.toContain('animate-pulse')

      rerender(<LazyMediaWrapper src="https://example.com/image2.jpg" alt="Test" priority />)

      // После смены src inner component remount-ится (key=src) → fresh state → animate-pulse вернулся.
      // container.firstChild обновляется на новый DOM-элемент нового LazyMediaWrapperContent.
      expect((container.firstChild as HTMLElement).className).toContain('animate-pulse')
    })

    it('сбрасывает isError при смене src — fallback исчезает', () => {
      const { container, getByRole, rerender } = render(
        <LazyMediaWrapper src="https://example.com/broken.jpg" alt="Test" priority />
      )

      fireEvent.error(getByRole('img', { name: 'Test' }))
      expect(container.querySelector('[data-testid="media-error-fallback"]')).toBeTruthy()

      rerender(<LazyMediaWrapper src="https://example.com/good.jpg" alt="Test" priority />)

      expect(container.querySelector('[data-testid="media-error-fallback"]')).toBeNull()
    })
  })

  describe('сброс isInView при смене src (key={src} ремаунт)', () => {
    it('сбрасывает isInView при смене src — ленивое изображение не показывается до нового пересечения', () => {
      const { container, queryByRole, rerender } = render(
        <LazyMediaWrapper src="https://example.com/image1.jpg" alt="Test" />
      )
      const wrapper = container.firstChild as HTMLElement

      // Симулируем попадание в viewport — isInView=true
      act(() => {
        capturedCallback?.(
          [{ isIntersecting: true, target: wrapper } as unknown as IntersectionObserverEntry],
          {} as IntersectionObserver
        )
      })

      expect(queryByRole('img')).not.toBeNull()

      // Меняем src — LazyMediaWrapperContent remount-ится (key=src), isInView сбрасывается в false
      rerender(<LazyMediaWrapper src="https://example.com/image2.jpg" alt="Test" />)

      // Новый компонент ещё не попал в viewport → изображение не должно рендериться
      expect(queryByRole('img')).toBeNull()
    })
  })


  describe('защита от двойного обращения к уничтоженному observer', () => {
    it('после intersection не вызывает unobserve при анмаунте (observer уже disconnected)', () => {
      const { container, unmount } = render(
        <LazyMediaWrapper src="https://example.com/image.jpg" alt="Test" />
      )
      const wrapper = container.firstChild as HTMLElement

      // Симулируем попадание в viewport → callback: unobserve + disconnect
      act(() => {
        capturedCallback?.(
          [{ isIntersecting: true, target: wrapper } as unknown as IntersectionObserverEntry],
          {} as IntersectionObserver
        )
      })

      expect(unobserveMock).toHaveBeenCalledTimes(1)
      expect(disconnectMock).toHaveBeenCalledTimes(1)
      unobserveMock.mockClear()
      disconnectMock.mockClear()

      // Анмаунт — cleanup НЕ должен вызывать unobserve на уже уничтоженном observer
      unmount()

      expect(unobserveMock).not.toHaveBeenCalled()
      expect(disconnectMock).not.toHaveBeenCalled()
    })
  })

  describe('mediaItem prop (AC 6, 7, 8)', () => {
    const makeMediaItem = (overrides?: Partial<{
      media_type: 'image' | 'video'
      url: string
      thumbnail_url: string | null
    }>) => ({
      id: 'media-1',
      post_id: 'post-1',
      media_type: 'image' as const,
      url: 'https://example.com/photo.jpg',
      thumbnail_url: null,
      order_index: 0,
      is_cover: true,
      ...overrides,
    })

    it('отображает изображение по mediaItem.url при media_type="image" (AC 6)', () => {
      const { getByRole } = render(
        <LazyMediaWrapper mediaItem={makeMediaItem()} alt="Фото" priority />
      )
      const img = getByRole('img', { name: 'Фото' })
      expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg')
    })

    it('использует thumbnail_url как постер для видео (AC 7)', () => {
      const { getByRole } = render(
        <LazyMediaWrapper
          mediaItem={makeMediaItem({
            media_type: 'video',
            url: 'https://example.com/video.mp4',
            thumbnail_url: 'https://example.com/thumb.jpg',
          })}
          alt="Видео"
          priority
        />
      )
      const img = getByRole('img', { name: 'Видео' })
      expect(img).toHaveAttribute('src', 'https://example.com/thumb.jpg')
    })

    it('использует url как фоллбек постера видео при thumbnail_url=null (AC 7)', () => {
      const { getByRole } = render(
        <LazyMediaWrapper
          mediaItem={makeMediaItem({
            media_type: 'video',
            url: 'https://example.com/video.mp4',
            thumbnail_url: null,
          })}
          alt="Видео"
          priority
        />
      )
      const img = getByRole('img', { name: 'Видео' })
      expect(img).toHaveAttribute('src', 'https://example.com/video.mp4')
    })

    it('показывает play-иконку для видео mediaItem после загрузки (AC 7)', () => {
      const { container, getByRole } = render(
        <LazyMediaWrapper
          mediaItem={makeMediaItem({ media_type: 'video', thumbnail_url: 'https://example.com/t.jpg' })}
          alt="Видео"
          priority
        />
      )
      fireEvent.load(getByRole('img', { name: 'Видео' }))
      const playIcon = container.querySelector('svg path[d="M8 5v14l11-7z"]')
      expect(playIcon).not.toBeNull()
    })

    it('не применяет aspect-ratio класс при aspectRatio="none" (гибкая сетка AC 8)', () => {
      const { container } = render(
        <LazyMediaWrapper src="https://example.com/img.jpg" alt="Test" aspectRatio="none" />
      )
      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.className).not.toMatch(/\baspect-/)
    })

    it('mediaItem сбрасывает состояние при смене url (key по effectiveSrc)', () => {
      const item1 = makeMediaItem({ url: 'https://example.com/photo1.jpg' })
      const item2 = makeMediaItem({ url: 'https://example.com/photo2.jpg' })
      const { container, rerender } = render(
        <LazyMediaWrapper mediaItem={item1} alt="Test" priority />
      )
      fireEvent.load(container.querySelector('img')!)
      expect((container.firstChild as HTMLElement).className).not.toContain('animate-pulse')

      rerender(<LazyMediaWrapper mediaItem={item2} alt="Test" priority />)
      expect((container.firstChild as HTMLElement).className).toContain('animate-pulse')
    })
  })

  describe('onLoad: снятие скелетона и видимость изображения', () => {
    it('убирает animate-pulse после события onLoad (priority=true)', () => {
      const { container, getByRole } = render(
        <LazyMediaWrapper src="https://example.com/image.jpg" alt="Test" priority />
      )
      const wrapper = container.firstChild as HTMLElement

      // До загрузки — скелетон активен
      expect(wrapper.className).toContain('animate-pulse')

      // Симулируем загрузку изображения
      fireEvent.load(getByRole('img', { name: 'Test' }))

      // После загрузки — скелетон снят
      expect(wrapper.className).not.toContain('animate-pulse')
    })

    it('не применяет opacity-0 на изображении при priority=true (LCP)', () => {
      const { getByRole } = render(
        <LazyMediaWrapper src="https://example.com/image.jpg" alt="Priority" priority />
      )
      const img = getByRole('img', { name: 'Priority' })
      expect(img.className).not.toContain('opacity-0')
    })

    it('показывает изображение (opacity-100) после intersection и onLoad (priority=false)', () => {
      const { container, getByRole, queryByRole } = render(
        <LazyMediaWrapper src="https://example.com/image.jpg" alt="Lazy" />
      )
      const wrapper = container.firstChild as HTMLElement

      // До intersection — изображения нет
      expect(queryByRole('img')).toBeNull()

      // Симулируем попадание в viewport
      act(() => {
        capturedCallback?.(
          [{ isIntersecting: true, target: wrapper } as unknown as IntersectionObserverEntry],
          {} as IntersectionObserver
        )
      })

      // Изображение появилось в DOM с opacity-0 (до onLoad)
      const img = getByRole('img', { name: 'Lazy' })
      expect(img.className).toContain('opacity-0')

      // Симулируем завершение загрузки
      fireEvent.load(img)

      // Скелетон снят, opacity-100
      expect(wrapper.className).not.toContain('animate-pulse')
      expect(img.className).toContain('opacity-100')
      expect(img.className).not.toContain('opacity-0')
    })
  })
})
