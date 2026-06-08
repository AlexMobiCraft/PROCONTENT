import { describe, it, expect, vi } from 'vitest'
import { waitForCondition } from '@/lib/waitForCondition'

describe('waitForCondition', () => {
  it('сразу разрешается, если предикат уже true', async () => {
    const predicate = vi.fn(() => true)
    await expect(
      waitForCondition(predicate, { timeoutMs: 1000 })
    ).resolves.toBeUndefined()
    expect(predicate).toHaveBeenCalledTimes(1)
  })

  it('разрешается раньше таймаута, когда предикат становится true', async () => {
    vi.useFakeTimers()
    try {
      let ready = false
      const promise = waitForCondition(() => ready, {
        timeoutMs: 5000,
        intervalMs: 100,
      })
      ready = true
      await vi.advanceTimersByTimeAsync(100)
      await expect(promise).resolves.toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('разрешается по таймауту, даже если предикат остаётся false (bound)', async () => {
    vi.useFakeTimers()
    try {
      const predicate = vi.fn(() => false)
      const promise = waitForCondition(predicate, {
        timeoutMs: 2500,
        intervalMs: 100,
      })
      await vi.advanceTimersByTimeAsync(2500)
      await expect(promise).resolves.toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })
})
