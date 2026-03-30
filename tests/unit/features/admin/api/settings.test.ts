import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockRpc = vi.fn()

function makeChain(result: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  }
  return chain
}

let supabaseChain: ReturnType<typeof makeChain>

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (...args: unknown[]) => {
      mockFrom(...args)
      return supabaseChain
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}))

import { getSettings, updateSettings } from '@/features/admin/api/settings'

describe('getSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('возвращает whatsapp_url из БД', async () => {
    supabaseChain = makeChain({ data: { whatsapp_url: 'https://chat.whatsapp.com/test' }, error: null })
    const result = await getSettings()
    expect(result.whatsapp_url).toBe('https://chat.whatsapp.com/test')
    expect(mockFrom).toHaveBeenCalledWith('site_settings')
  })

  it('выбрасывает ошибку при сбое БД', async () => {
    supabaseChain = makeChain({ data: null, error: { message: 'DB error', code: '500' } })
    await expect(getSettings()).rejects.toBeDefined()
  })
})

describe('updateSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('обновляет whatsapp_url и возвращает обновлённые данные', async () => {
    supabaseChain = makeChain({
      data: { whatsapp_url: 'https://chat.whatsapp.com/new' },
      error: null,
    })
    const result = await updateSettings({ whatsapp_url: 'https://chat.whatsapp.com/new' })
    expect(result.whatsapp_url).toBe('https://chat.whatsapp.com/new')
    expect(mockFrom).toHaveBeenCalledWith('site_settings')
  })

  it('выбрасывает ошибку при сбое обновления', async () => {
    supabaseChain = makeChain({ data: null, error: { message: 'Update failed', code: '500' } })
    await expect(updateSettings({ whatsapp_url: 'https://example.com' })).rejects.toBeDefined()
  })

  it('выбрасывает ошибку если data null', async () => {
    supabaseChain = makeChain({ data: null, error: null })
    await expect(updateSettings({ whatsapp_url: 'https://example.com' })).rejects.toThrow(
      'Nastavitve niso bile vrnjene po posodobitvi'
    )
  })
})
