import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()

function makeChain(result: unknown) {
  return {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue(result),
  }
}

let supabaseChain: ReturnType<typeof makeChain>

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (...args: unknown[]) => {
      mockFrom(...args)
      return supabaseChain
    },
  }),
}))

import { toggleMemberAccess } from '@/features/admin/api/members'

describe('toggleMemberAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('выдаёт доступ — обновляет subscription_status на "active"', async () => {
    supabaseChain = makeChain({ data: null, error: null })
    await expect(toggleMemberAccess('user-1', true)).resolves.toBeUndefined()
    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(supabaseChain.update).toHaveBeenCalledWith({ subscription_status: 'active' })
    expect(supabaseChain.eq).toHaveBeenCalledWith('id', 'user-1')
  })

  it('забирает доступ — обновляет subscription_status на "canceled"', async () => {
    supabaseChain = makeChain({ data: null, error: null })
    await expect(toggleMemberAccess('user-2', false)).resolves.toBeUndefined()
    expect(supabaseChain.update).toHaveBeenCalledWith({ subscription_status: 'canceled' })
    expect(supabaseChain.eq).toHaveBeenCalledWith('id', 'user-2')
  })

  it('выбрасывает ошибку при сбое БД', async () => {
    supabaseChain = makeChain({ data: null, error: { message: 'DB error', code: '500' } })
    await expect(toggleMemberAccess('user-3', true)).rejects.toBeDefined()
  })
})
