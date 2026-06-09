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

  it('не спит дольше дедлайна: разрешается ровно к таймауту, не на целый интервал позже', async () => {
    vi.useFakeTimers()
    try {
      let resolved = false
      const predicate = vi.fn(() => false)
      void waitForCondition(predicate, { timeoutMs: 250, intervalMs: 100 }).then(
        () => {
          resolved = true
        }
      )
      await vi.advanceTimersByTimeAsync(250)
      expect(resolved).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
