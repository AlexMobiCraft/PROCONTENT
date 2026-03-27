import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockBatchSend } = vi.hoisted(() => {
  const mockBatchSend = vi.fn()
  return { mockBatchSend }
})

vi.mock('resend', () => ({
  // Regular function (not arrow) so it can be used as a constructor with `new`
  Resend: vi.fn().mockImplementation(function () {
    return { batch: { send: mockBatchSend } }
  }),
}))

import { sendEmailBatch } from '@/lib/email'
import type { EmailMessage } from '@/lib/email'

const MSG = (n: number): EmailMessage => ({
  to: `user${n}@example.com`,
  subject: `Test ${n}`,
  html: `<p>Test ${n}</p>`,
  text: `Test ${n}`,
})

describe('sendEmailBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('RESEND_API_KEY', 're_test_key')
    vi.stubEnv('RESEND_FROM_EMAIL', 'noreply@procontent.si')
  })

  it('возвращает { sent: 0, failed: 0 } для пустого массива', async () => {
    const result = await sendEmailBatch([])
    expect(result).toEqual({ sent: 0, failed: 0 })
    expect(mockBatchSend).not.toHaveBeenCalled()
  })

  it('считает sent по количеству успешных результатов в data', async () => {
    mockBatchSend.mockResolvedValue({
      data: { data: [{ id: 'id-1' }, { id: 'id-2' }] },
      error: null,
    })

    const result = await sendEmailBatch([MSG(1), MSG(2)])
    expect(result.sent).toBe(2)
    expect(result.failed).toBe(0)
  })

  it('считает failed для частичного успеха батча (partial batch)', async () => {
    // 3 писем отправлено, но только 2 приняты Resend
    mockBatchSend.mockResolvedValue({
      data: { data: [{ id: 'id-1' }, { id: 'id-2' }] },
      error: null,
    })

    const result = await sendEmailBatch([MSG(1), MSG(2), MSG(3)])
    expect(result.sent).toBe(2)
    expect(result.failed).toBe(1)
  })

  it('считает весь чанк как failed при ошибке батча', async () => {
    mockBatchSend.mockResolvedValue({
      data: null,
      error: { message: 'API error' },
    })

    const result = await sendEmailBatch([MSG(1), MSG(2)])
    expect(result.sent).toBe(0)
    expect(result.failed).toBe(2)
  })

  it('считает sent=0 и failed=chunk.length когда data=null без ошибки', async () => {
    // Edge case: нет ошибки, но data тоже null
    mockBatchSend.mockResolvedValue({ data: null, error: null })

    const result = await sendEmailBatch([MSG(1), MSG(2)])
    expect(result.sent).toBe(0)
    expect(result.failed).toBe(2)
  })

  it('бросает ошибку при отсутствии RESEND_FROM_EMAIL', async () => {
    vi.stubEnv('RESEND_FROM_EMAIL', '')

    await expect(sendEmailBatch([MSG(1)])).rejects.toThrow('RESEND_FROM_EMAIL')
  })
})
