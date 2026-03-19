import { render, fireEvent, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { LazyMediaWrapper } from '@/components/media/LazyMediaWrapper'
import { _resetSharedObserver } from '@/hooks/useInView'

vi.mock('next/image', () => ({
  default: ({
    alt,
    className,
    onLoad,
    onError,
  }: {
    alt?: string
    className?: string
    onLoad?: () => void
    onError?: () => void
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt ?? ''} className={className} onLoad={onLoad} onError={onError} />
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
          [{ isIntersecting: true, target: wrapper } as IntersectionObserverEntry],
          {} as IntersectionObserver
        )
      })

      const img = container.querySelector('img')!
      fireEvent.error(img)

      expect(wrapper.className).not.toContain('animate-pulse')
      expect(container.querySelector('[data-testid="media-error-fallback"]')).toBeTruthy()
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
          [{ isIntersecting: true, target: wrapper } as IntersectionObserverEntry],
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
