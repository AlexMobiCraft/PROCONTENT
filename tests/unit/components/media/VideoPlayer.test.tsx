import { render, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { VideoPlayer } from '@/components/media/VideoPlayer'

// Мок useVideoController — изолируем компонент от хука
const mockHandlePlay = vi.fn()
const mockHandlePause = vi.fn()
const mockVideoRef = { current: null as HTMLVideoElement | null }

vi.mock('@/hooks/useVideoController', () => ({
  useVideoController: vi.fn(() => ({
    videoRef: mockVideoRef,
    isActive: false,
    handlePlay: mockHandlePlay,
    handlePause: mockHandlePause,
  })),
}))

beforeEach(() => {
  mockHandlePlay.mockClear()
  mockHandlePause.mockClear()
})

describe('VideoPlayer', () => {
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

  it('вызывает handlePlay при событии play', () => {
    const { container } = render(<VideoPlayer videoId="v1" src="https://example.com/v.mp4" />)
    fireEvent.play(container.querySelector('video')!)
    expect(mockHandlePlay).toHaveBeenCalledTimes(1)
  })

  it('вызывает handlePause при событии pause', () => {
    const { container } = render(<VideoPlayer videoId="v1" src="https://example.com/v.mp4" />)
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
})
