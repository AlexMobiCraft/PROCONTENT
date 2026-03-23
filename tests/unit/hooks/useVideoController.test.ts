import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useVideoController } from '@/hooks/useVideoController'
import { useFeedStore } from '@/features/feed/store'

// Мок IntersectionObserver (не реализован в jsdom)
const observeMock = vi.fn()
const disconnectMock = vi.fn()

class MockIntersectionObserver {
  constructor(public callback: IntersectionObserverCallback) {}
  observe = observeMock
  unobserve = vi.fn()
  disconnect = disconnectMock
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
  // Сброс store к исходному состоянию
  useFeedStore.setState({ activeVideoId: null })
  observeMock.mockClear()
  disconnectMock.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useVideoController', () => {
  it('возвращает videoRef, isActive, handlePlay, handlePause', () => {
    const { result } = renderHook(() => useVideoController('video-1'))
    expect(result.current.videoRef).toBeDefined()
    expect(result.current.videoRef.current).toBeNull() // нет DOM-элемента в тесте
    expect(result.current.isActive).toBe(false)
    expect(typeof result.current.handlePlay).toBe('function')
    expect(typeof result.current.handlePause).toBe('function')
  })

  it('isActive=true когда activeVideoId совпадает с videoId', () => {
    useFeedStore.setState({ activeVideoId: 'video-1' })
    const { result } = renderHook(() => useVideoController('video-1'))
    expect(result.current.isActive).toBe(true)
  })

  it('isActive=false когда activeVideoId отличается от videoId', () => {
    useFeedStore.setState({ activeVideoId: 'video-2' })
    const { result } = renderHook(() => useVideoController('video-1'))
    expect(result.current.isActive).toBe(false)
  })

  it('handlePlay вызывает setActiveVideo(videoId)', () => {
    const { result } = renderHook(() => useVideoController('video-1'))
    act(() => result.current.handlePlay())
    expect(useFeedStore.getState().activeVideoId).toBe('video-1')
  })

  it('handlePause сбрасывает activeVideoId когда это наше видео', () => {
    useFeedStore.setState({ activeVideoId: 'video-1' })
    const { result } = renderHook(() => useVideoController('video-1'))
    act(() => result.current.handlePause())
    expect(useFeedStore.getState().activeVideoId).toBeNull()
  })

  it('handlePause не сбрасывает activeVideoId если активно другое видео', () => {
    useFeedStore.setState({ activeVideoId: 'video-2' })
    const { result } = renderHook(() => useVideoController('video-1'))
    act(() => result.current.handlePause())
    // video-1 не должен сбрасывать state video-2
    expect(useFeedStore.getState().activeVideoId).toBe('video-2')
  })

  it('вызывает pause() на videoRef когда activeVideoId меняется на другое видео', () => {
    const { result } = renderHook(() => useVideoController('video-1'))

    // Мокаем videoRef.current — нативный HTMLVideoElement не доступен в jsdom
    const mockPause = vi.fn()
    Object.defineProperty(result.current.videoRef, 'current', {
      value: { pause: mockPause, paused: false },
      writable: true,
    })

    // Активируем другое видео → должен вызваться pause()
    act(() => useFeedStore.setState({ activeVideoId: 'video-2' }))
    expect(mockPause).toHaveBeenCalledTimes(1)
  })

  it('не вызывает pause() когда activeVideoId совпадает с videoId', () => {
    const { result } = renderHook(() => useVideoController('video-1'))

    const mockPause = vi.fn()
    Object.defineProperty(result.current.videoRef, 'current', {
      value: { pause: mockPause, paused: false },
      writable: true,
    })

    // Активируем то же видео — pause() не вызывается
    act(() => useFeedStore.setState({ activeVideoId: 'video-1' }))
    expect(mockPause).not.toHaveBeenCalled()
  })
})
