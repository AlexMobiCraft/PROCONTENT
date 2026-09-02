import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// --- Моки подняты до импортов ---

const { mockSendEmailBatch } = vi.hoisted(() => {
  const mockSendEmailBatch = vi.fn()
  return { mockSendEmailBatch }
})

vi.mock('@/lib/email', () => ({
  sendEmailBatch: mockSendEmailBatch,
}))

import { sendRegistrationInvite } from '@/lib/notifications/sendRegistrationInvite'

const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL

describe('sendRegistrationInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendEmailBatch.mockResolvedValue({ sent: 1, failed: 0 })
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.procontent.si'
  })

  afterEach(() => {
    // Присваивание undefined дало бы строку "undefined" — восстанавливаем через delete
    if (ORIGINAL_SITE_URL === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_SITE_URL
    }
  })

  it('отправляет письмо со ссылкой на /register с session_id', async () => {
    const result = await sendRegistrationInvite({
      email: 'nova@example.com',
      sessionId: 'cs_live_abc123',
    })

    expect(mockSendEmailBatch).toHaveBeenCalledTimes(1)

    const [messages] = mockSendEmailBatch.mock.calls[0]
    expect(messages).toHaveLength(1)
    expect(messages[0].to).toBe('nova@example.com')
    expect(messages[0].subject).toContain('PROCONTENT')
    expect(messages[0].html).toContain(
      'https://www.procontent.si/register?session_id=cs_live_abc123'
    )
    expect(messages[0].text).toContain(
      'https://www.procontent.si/register?session_id=cs_live_abc123'
    )
    expect(result).toEqual({ sent: 1, failed: 0 })
  })

  it('срезает хвостовые слэши у NEXT_PUBLIC_SITE_URL', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.procontent.si//'

    await sendRegistrationInvite({ email: 'nova@example.com', sessionId: 'cs_1' })

    const [messages] = mockSendEmailBatch.mock.calls[0]
    expect(messages[0].html).toContain('https://www.procontent.si/register?session_id=cs_1')
    expect(messages[0].html).not.toContain('procontent.si//register')
  })

  it('подставляет имя получательницы, если оно передано', async () => {
    await sendRegistrationInvite({
      email: 'nova@example.com',
      sessionId: 'cs_1',
      recipientName: 'Laura Maja',
    })

    const [messages] = mockSendEmailBatch.mock.calls[0]
    expect(messages[0].text).toContain('Pozdravljeni, Laura Maja!')
  })

  it('бросает, если NEXT_PUBLIC_SITE_URL не задан', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL

    await expect(
      sendRegistrationInvite({ email: 'nova@example.com', sessionId: 'cs_1' })
    ).rejects.toThrow('NEXT_PUBLIC_SITE_URL')

    expect(mockSendEmailBatch).not.toHaveBeenCalled()
  })

  it('пропускает отправку при пустом или битом email', async () => {
    await expect(sendRegistrationInvite({ email: '  ', sessionId: 'cs_1' })).resolves.toEqual({
      skipped: 'no_email',
    })
    await expect(
      sendRegistrationInvite({ email: 'not-an-email', sessionId: 'cs_1' })
    ).resolves.toEqual({ skipped: 'no_email' })

    expect(mockSendEmailBatch).not.toHaveBeenCalled()
  })

  it('пропускает отправку при пустом sessionId', async () => {
    await expect(
      sendRegistrationInvite({ email: 'nova@example.com', sessionId: '   ' })
    ).resolves.toEqual({ skipped: 'no_session_id' })

    expect(mockSendEmailBatch).not.toHaveBeenCalled()
  })

  it('пробрасывает ошибку конфигурации Resend наружу', async () => {
    mockSendEmailBatch.mockRejectedValue(new Error('[email] RESEND_API_KEY is not configured'))

    await expect(
      sendRegistrationInvite({ email: 'nova@example.com', sessionId: 'cs_1' })
    ).rejects.toThrow('RESEND_API_KEY')
  })

  // sendEmailBatch не бросает на отказе доставки — возвращает failed > 0.
  // Результат обязан дойти до вызывающего, иначе потеря письма пройдёт молча.
  it('возвращает partial-fail Resend, не выдавая его за успех', async () => {
    mockSendEmailBatch.mockResolvedValue({ sent: 0, failed: 1 })

    await expect(
      sendRegistrationInvite({ email: 'nova@example.com', sessionId: 'cs_1' })
    ).resolves.toEqual({ sent: 0, failed: 1 })
  })

  it('бросает, если NEXT_PUBLIC_SITE_URL задан без http(s)-схемы', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'www.procontent.si'

    await expect(
      sendRegistrationInvite({ email: 'nova@example.com', sessionId: 'cs_1' })
    ).rejects.toThrow('absolute http(s) URL')

    expect(mockSendEmailBatch).not.toHaveBeenCalled()
  })

  it('обрезает слишком длинное имя из Stripe', async () => {
    await sendRegistrationInvite({
      email: 'nova@example.com',
      sessionId: 'cs_1',
      recipientName: 'A'.repeat(500),
    })

    const [messages] = mockSendEmailBatch.mock.calls[0]
    expect(messages[0].text).toContain(`Pozdravljeni, ${'A'.repeat(80)}!`)
    expect(messages[0].text).not.toContain('A'.repeat(81))
  })
})
