import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from '@/hooks/useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('возвращает начальное значение немедленно', () => {
    const { result } = renderHook(() => useDebounce('initial', 400))
    expect(result.current).toBe('initial')
  })

  it('не обновляет значение до истечения задержки', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 400), {
      initialProps: { v: 'initial' },
    })

    rerender({ v: 'updated' })
    // До истечения 400ms — возвращает старое значение
    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current).toBe('initial')
  })

  it('обновляет значение после истечения задержки', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 400), {
      initialProps: { v: 'initial' },
    })

    rerender({ v: 'updated' })
    act(() => { vi.advanceTimersByTime(400) })
    expect(result.current).toBe('updated')
  })

  it('сбрасывает таймер при быстром вводе', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 400), {
      initialProps: { v: 'a' },
    })

    rerender({ v: 'ab' })
    act(() => { vi.advanceTimersByTime(200) })

    rerender({ v: 'abc' })
    act(() => { vi.advanceTimersByTime(200) })
    // Ещё не истекло 400ms от последнего ввода
    expect(result.current).toBe('a')

    act(() => { vi.advanceTimersByTime(200) })
    // Теперь 400ms с момента 'abc' — обновляется
    expect(result.current).toBe('abc')
  })

  it('использует задержку по умолчанию 400ms', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v), {
      initialProps: { v: 'first' },
    })

    rerender({ v: 'second' })
    act(() => { vi.advanceTimersByTime(399) })
    expect(result.current).toBe('first')

    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current).toBe('second')
  })
})
