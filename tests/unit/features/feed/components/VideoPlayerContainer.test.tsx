import { render } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { VideoPlayerContainer } from '@/features/feed/components/VideoPlayerContainer'

// Мок useVideoController — изолируем от store
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

// Мок VideoPlayer — проверяем что правильные пропсы прокидываются
const capturedProps: Record<string, unknown>[] = []

vi.mock('@/components/media/VideoPlayer', () => ({
  VideoPlayer: (props: Record<string, unknown>) => {
    capturedProps.push(props)
    return <div data-testid="video-player" />
  },
}))

beforeEach(() => {
  mockHandlePlay.mockClear()
  mockHandlePause.mockClear()
  capturedProps.length = 0
})

describe('VideoPlayerContainer', () => {
  it('рендерит VideoPlayer', () => {
    const { getByTestId } = render(
      <VideoPlayerContainer videoId="v1" src="https://example.com/v.mp4" />
    )
    expect(getByTestId('video-player')).toBeInTheDocument()
  })

  it('прокидывает onPlay=handlePlay из useVideoController в VideoPlayer', () => {
    render(<VideoPlayerContainer videoId="v1" src="https://example.com/v.mp4" />)
    expect(capturedProps[0].onPlay).toBe(mockHandlePlay)
  })

  it('прокидывает onPause=handlePause из useVideoController в VideoPlayer', () => {
    render(<VideoPlayerContainer videoId="v1" src="https://example.com/v.mp4" />)
    expect(capturedProps[0].onPause).toBe(mockHandlePause)
  })

  it('прокидывает ref=videoRef из useVideoController в VideoPlayer', () => {
    render(<VideoPlayerContainer videoId="v1" src="https://example.com/v.mp4" />)
    expect(capturedProps[0].ref).toBe(mockVideoRef)
  })

  it('прокидывает src и прочие пропсы без изменений', () => {
    render(
      <VideoPlayerContainer
        videoId="v1"
        src="https://example.com/v.mp4"
        poster="https://example.com/p.jpg"
        priority
        aspectRatio="1/1"
      />
    )
    expect(capturedProps[0].src).toBe('https://example.com/v.mp4')
    expect(capturedProps[0].poster).toBe('https://example.com/p.jpg')
    expect(capturedProps[0].priority).toBe(true)
    expect(capturedProps[0].aspectRatio).toBe('1/1')
  })
})
