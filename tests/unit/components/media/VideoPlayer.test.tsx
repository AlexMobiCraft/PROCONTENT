import { render, fireEvent, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { VideoPlayer } from '@/components/media/VideoPlayer'

// Мок IntersectionObserver (не реализован в jsdom)
let capturedCallback: IntersectionObserverCallback | null = null
const observeMock = vi.fn()
const disconnectMock = vi.fn()

beforeEach(() => {
  capturedCallback = null
  observeMock.mockClear()
  disconnectMock.mockClear()
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: IntersectionObserverCallback) {
        capturedCallback = cb
      }
      observe = observeMock
      disconnect = disconnectMock
    }
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const mockHandlePlay = vi.fn()
const mockHandlePause = vi.fn()

describe('VideoPlayer', () => {
  beforeEach(() => {
    mockHandlePlay.mockClear()
    mockHandlePause.mockClear()
  })

  it('рендерит <video> элемент', () => {
    const { container } = render(<VideoPlayer videoId="v1" src="https://example.com/v.mp4" />)
    expect(container.querySelector('video')).toBeInTheDocument()
  })

  it('устанавливает src из пропса', () => {
    const { container } = render(<VideoPlayer videoId="v1" src="https://example.com/v.mp4" />)
    expect(container.querySelector('video')).toHaveAttribute('src', 'https://example.com/v.mp4')
  })

  it('устанавливает poster из пропса', () => {
    const { container } = render(
      <VideoPlayer videoId="v1" src="https://example.com/v.mp4" poster="https://example.com/p.jpg" />
    )
    expect(container.querySelector('video')).toHaveAttribute('poster', 'https://example.com/p.jpg')
  })

  it('имеет атрибут playsInline', () => {
    const { container } = render(<VideoPlayer videoId="v1" src="https://example.com/v.mp4" />)
    expect(container.querySelector('video')).toHaveAttribute('playsInline')
  })

  it('имеет preload="none" по умолчанию', () => {
    const { container } = render(<VideoPlayer videoId="v1" src="https://example.com/v.mp4" />)
    expect(container.querySelector('video')).toHaveAttribute('preload', 'none')
  })

  it('имеет preload="metadata" при priority=true', () => {
    const { container } = render(
      <VideoPlayer videoId="v1" src="https://example.com/v.mp4" priority />
    )
    expect(container.querySelector('video')).toHaveAttribute('preload', 'metadata')
  })

  it('имеет атрибут controls', () => {
    const { container } = render(<VideoPlayer videoId="v1" src="https://example.com/v.mp4" />)
    expect(container.querySelector('video')).toHaveAttribute('controls')
  })

  it('вызывает onPlay при событии play', () => {
    const { container } = render(
      <VideoPlayer videoId="v1" src="https://example.com/v.mp4" onPlay={mockHandlePlay} />
    )
    fireEvent.play(container.querySelector('video')!)
    expect(mockHandlePlay).toHaveBeenCalledTimes(1)
  })

  it('вызывает onPause при событии pause', () => {
    const { container } = render(
      <VideoPlayer videoId="v1" src="https://example.com/v.mp4" onPause={mockHandlePause} />
    )
    fireEvent.pause(container.querySelector('video')!)
    expect(mockHandlePause).toHaveBeenCalledTimes(1)
  })

  it('устанавливает aria-label из пропса alt', () => {
    const { container } = render(
      <VideoPlayer videoId="v1" src="https://example.com/v.mp4" alt="Тестовое видео" />
    )
    expect(container.querySelector('video')).toHaveAttribute('aria-label', 'Тестовое видео')
  })

  it('применяет aspectRatio="1/1" → aspect-square класс', () => {
    const { container } = render(
      <VideoPlayer videoId="v1" src="https://example.com/v.mp4" aspectRatio="1/1" />
    )
    const wrapper = container.querySelector('div')
    expect(wrapper?.className).toContain('aspect-square')
  })

  it('по умолчанию aspectRatio="16/9" → aspect-video класс', () => {
    const { container } = render(<VideoPlayer videoId="v1" src="https://example.com/v.mp4" />)
    const wrapper = container.querySelector('div')
    expect(wrapper?.className).toContain('aspect-video')
  })

  it('не рендерит poster если пропс не передан', () => {
    const { container } = render(<VideoPlayer videoId="v1" src="https://example.com/v.mp4" />)
    expect(container.querySelector('video')).not.toHaveAttribute('poster')
  })

  it('video имеет class object-cover для соответствия LazyMediaWrapper', () => {
    const { container } = render(<VideoPlayer videoId="v1" src="https://example.com/v.mp4" />)
    expect(container.querySelector('video')?.className).toContain('object-cover')
  })

  it('isLoading=true рендерит skeleton вместо видео', () => {
    const { container, getByTestId } = render(
      <VideoPlayer videoId="v1" src="https://example.com/v.mp4" isLoading />
    )
    expect(getByTestId('video-player-skeleton')).toBeInTheDocument()
    expect(container.querySelector('video')).not.toBeInTheDocument()
  })

  it('skeleton имеет animate-pulse класс и корректный aspect-ratio', () => {
    const { getByTestId } = render(
      <VideoPlayer videoId="v1" src="https://example.com/v.mp4" isLoading aspectRatio="1/1" />
    )
    const skeleton = getByTestId('video-player-skeleton')
    expect(skeleton.className).toContain('animate-pulse')
    expect(skeleton.className).toContain('aspect-square')
  })

  it('после перехода isLoading=true -> false подключает IntersectionObserver и автопауза начинает работать', () => {
    const { rerender, container } = render(
      <VideoPlayer videoId="v1" src="https://example.com/v.mp4" isLoading />
    )

    expect(observeMock).not.toHaveBeenCalled()

    rerender(<VideoPlayer videoId="v1" src="https://example.com/v.mp4" isLoading={false} />)

    const video = container.querySelector('video')!
    const pauseSpy = vi.spyOn(video, 'pause').mockImplementation(() => {})
    Object.defineProperty(video, 'paused', { value: false, writable: true, configurable: true })

    expect(observeMock).toHaveBeenCalledTimes(1)

    act(() => {
      capturedCallback!(
        [{ isIntersecting: false, intersectionRatio: 0.1, target: video } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    })

    expect(pauseSpy).toHaveBeenCalledTimes(1)
  })

  it('автопауза при выходе из viewport (intersectionRatio<0.2 → pause)', () => {
    const { container } = render(<VideoPlayer videoId="v1" src="https://example.com/v.mp4" />)
    const video = container.querySelector('video')!

    const pauseSpy = vi.spyOn(video, 'pause').mockImplementation(() => {})
    Object.defineProperty(video, 'paused', { value: false, writable: true, configurable: true })

    act(() => {
      capturedCallback!(
        [{ isIntersecting: false, intersectionRatio: 0.1, target: video } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    })

    expect(pauseSpy).toHaveBeenCalled()
  })

  it('НЕ вызывает pause при выходе из viewport если видео уже на паузе', () => {
    const { container } = render(<VideoPlayer videoId="v1" src="https://example.com/v.mp4" />)
    const video = container.querySelector('video')!

    const pauseSpy = vi.spyOn(video, 'pause').mockImplementation(() => {})
    // paused=true по умолчанию в jsdom

    act(() => {
      capturedCallback!(
        [{ isIntersecting: false, intersectionRatio: 0.1, target: video } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    })

    expect(pauseSpy).not.toHaveBeenCalled()
  })

  it('IntersectionObserver подключается при монтировании и отключается при размонтировании', () => {
    const { unmount } = render(<VideoPlayer videoId="v1" src="https://example.com/v.mp4" />)
    expect(observeMock).toHaveBeenCalled()
    unmount()
    expect(disconnectMock).toHaveBeenCalled()
  })

  it('не рендерит <track> элемент (субтитры вне scope MVP, правило линтера подавлено)', () => {
    const { container } = render(<VideoPlayer videoId="v1" src="https://example.com/v.mp4" />)
    expect(container.querySelector('track')).not.toBeInTheDocument()
  })

  it('сбрасывает состояние ошибки при смене src (key={src} → remount)', async () => {
    // Используем wrapper с key={src}: при смене src VideoPlayer ремаунтируется → hasError сбрасывается
    function Wrapper({ src }: { src: string }) {
      return <VideoPlayer key={src} videoId="v1" src={src} />
    }

    const { container, findByTestId, rerender, queryByTestId } = render(
      <Wrapper src="https://example.com/v.mp4" />
    )

    // Вызываем ошибку загрузки
    fireEvent.error(container.querySelector('video')!)
    await findByTestId('video-player-error')

    // Меняем src → key меняется → VideoPlayer ремаунтируется с hasError=false
    rerender(<Wrapper src="https://example.com/new-video.mp4" />)

    // Состояние ошибки сброшено, рендерится плеер с новым src
    expect(queryByTestId('video-player-error')).not.toBeInTheDocument()
    expect(container.querySelector('video')).toBeInTheDocument()
    expect(container.querySelector('video')).toHaveAttribute('src', 'https://example.com/new-video.mp4')
  })

  it('onError → рендерит состояние ошибки вместо плеера', async () => {
    const { container, findByTestId } = render(
      <VideoPlayer videoId="v1" src="https://example.com/v.mp4" />
    )
    fireEvent.error(container.querySelector('video')!)
    const errorEl = await findByTestId('video-player-error')
    expect(errorEl).toBeInTheDocument()
    expect(container.querySelector('video')).not.toBeInTheDocument()
  })

  it('состояние ошибки показывает текст "Napaka pri nalaganju videa"', async () => {
    const { container, findByText } = render(
      <VideoPlayer videoId="v1" src="https://example.com/v.mp4" />
    )
    fireEvent.error(container.querySelector('video')!)
    expect(await findByText('Napaka pri nalaganju videa')).toBeInTheDocument()
  })

  it('контейнер ошибки имеет role="alert" для поддержки скринридеров (A11y)', async () => {
    const { container, findByTestId } = render(
      <VideoPlayer videoId="v1" src="https://example.com/v.mp4" />
    )
    fireEvent.error(container.querySelector('video')!)
    const errorEl = await findByTestId('video-player-error')
    expect(errorEl).toHaveAttribute('role', 'alert')
    expect(errorEl).toHaveAttribute('aria-live', 'polite')
  })

  it('onError вызывает onPause для сброса activeVideoId в store', async () => {
    const { container } = render(
      <VideoPlayer videoId="v1" src="https://example.com/v.mp4" onPause={mockHandlePause} />
    )
    fireEvent.error(container.querySelector('video')!)
    expect(mockHandlePause).toHaveBeenCalledTimes(1)
  })

  it('IntersectionObserver отключается при переходе в состояние ошибки (Memory Leak fix)', async () => {
    const { container } = render(<VideoPlayer videoId="v1" src="https://example.com/v.mp4" />)
    expect(observeMock).toHaveBeenCalled()
    // До ошибки disconnect не вызывался
    expect(disconnectMock).not.toHaveBeenCalled()
    // Триггерим ошибку → hasError=true → useEffect cleanup → disconnect()
    await act(async () => {
      fireEvent.error(container.querySelector('video')!)
    })
    expect(disconnectMock).toHaveBeenCalled()
  })

  it('рендерит fallback-текст внутри <video> для старых браузеров [AI-Review Low]', () => {
    const { container } = render(<VideoPlayer videoId="v1" src="https://example.com/v.mp4" />)
    const video = container.querySelector('video')!
    expect(video.textContent).toContain('Vaš brskalnik ne podpira videa.')
  })
})
