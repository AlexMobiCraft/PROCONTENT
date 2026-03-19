import { render } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { LazyMediaWrapper } from '@/components/media/LazyMediaWrapper'

vi.mock('next/image', () => ({
  default: ({ alt, className, onLoad }: { alt?: string; className?: string; onLoad?: () => void }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt ?? ''} className={className} onLoad={onLoad} />
  ),
}))

const observeMock = vi.fn()
const disconnectMock = vi.fn()

class MockIntersectionObserver {
  callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    MockIntersectionObserver.lastInstance = this
  }

  observe = observeMock
  unobserve = vi.fn()
  disconnect = disconnectMock

  static lastInstance: MockIntersectionObserver
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

beforeEach(() => {
  observeMock.mockClear()
  disconnectMock.mockClear()
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
      render(
        <LazyMediaWrapper src="https://example.com/image.jpg" alt="Test" priority />
      )
      expect(observeMock).not.toHaveBeenCalled()
    })

    it('создаёт IntersectionObserver с rootMargin 200px', () => {
      const OriginalIO = IntersectionObserver
      let capturedOptions: IntersectionObserverInit | undefined

      vi.stubGlobal(
        'IntersectionObserver',
        class extends MockIntersectionObserver {
          constructor(cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) {
            super(cb)
            capturedOptions = opts
          }
        }
      )

      render(<LazyMediaWrapper src="https://example.com/image.jpg" alt="Test" />)

      expect(capturedOptions?.rootMargin).toBe('200px')

      vi.stubGlobal('IntersectionObserver', OriginalIO)
    })

    it('не рендерит изображение до пересечения viewport', () => {
      const { queryByRole } = render(
        <LazyMediaWrapper src="https://example.com/image.jpg" alt="Lazy image" />
      )
      expect(queryByRole('img')).toBeNull()
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
})
