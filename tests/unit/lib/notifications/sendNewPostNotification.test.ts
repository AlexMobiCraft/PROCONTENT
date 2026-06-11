import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Моки подняты до импортов ---

const { mockSendEmailBatch } = vi.hoisted(() => {
  const mockSendEmailBatch = vi.fn()
  return { mockSendEmailBatch }
})

vi.mock('@/lib/email', () => ({
  sendEmailBatch: mockSendEmailBatch,
}))

// Мок admin Supabase-клиента (createClient из @supabase/supabase-js)
// Цепочка: from → select → in → not → eq → order → range
const {
  mockAdminRange,
  mockAdminOrder,
  mockAdminEq,
  mockAdminNot,
  mockAdminIn,
  mockAdminSelect,
  mockAdminFrom,
  mockCreateAdminClient,
} = vi.hoisted(() => {
  const mockAdminRange = vi.fn()
  const mockAdminOrder = vi.fn(() => ({ range: mockAdminRange }))
  const mockAdminEq = vi.fn(() => ({ order: mockAdminOrder }))
  const mockAdminNot = vi.fn(() => ({ eq: mockAdminEq }))
  const mockAdminIn = vi.fn(() => ({ not: mockAdminNot }))
  const mockAdminSelect = vi.fn(() => ({ in: mockAdminIn }))
  const mockAdminFrom = vi.fn(() => ({ select: mockAdminSelect }))
  const mockCreateAdminClient = vi.fn(() => ({ from: mockAdminFrom }))
  return {
    mockAdminRange,
    mockAdminOrder,
    mockAdminEq,
    mockAdminNot,
    mockAdminIn,
    mockAdminSelect,
    mockAdminFrom,
    mockCreateAdminClient,
  }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateAdminClient,
}))

import { sendNewPostNotification, PAGE_SIZE } from '@/lib/notifications/sendNewPostNotification'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_POST = { id: VALID_UUID, title: 'Test Post Title' }

const ACTIVE_SUBSCRIBERS = [
  { id: '11111111-1111-1111-1111-111111111111', email: 'user1@example.com', display_name: 'Ana' },
  { id: '22222222-2222-2222-2222-222222222222', email: 'user2@example.com', display_name: null },
]

describe('sendNewPostNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NOTIFICATION_API_SECRET', 'test-secret-key')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.procontent.si')
    vi.stubEnv('RESEND_API_KEY', 're_test_key')
    vi.stubEnv('RESEND_FROM_EMAIL', 'noreply@procontent.si')

    mockAdminFrom.mockReturnValue({ select: mockAdminSelect })
    mockAdminSelect.mockReturnValue({ in: mockAdminIn })
    mockAdminIn.mockReturnValue({ not: mockAdminNot })
    mockAdminNot.mockReturnValue({ eq: mockAdminEq })
    mockAdminEq.mockReturnValue({ order: mockAdminOrder })
    mockAdminOrder.mockReturnValue({ range: mockAdminRange })
    mockAdminRange.mockResolvedValue({ data: ACTIVE_SUBSCRIBERS, error: null })

    mockSendEmailBatch.mockResolvedValue({ sent: 2, failed: 0 })
  })

  describe('Happy path', () => {
    it('загружает подписчиков, собирает messages и вызывает sendEmailBatch', async () => {
      const result = await sendNewPostNotification(VALID_POST)

      expect(mockSendEmailBatch).toHaveBeenCalledOnce()
      const [messages] = mockSendEmailBatch.mock.calls[0] as [unknown[]]
      expect(messages).toHaveLength(2)
      expect(result).toEqual({ sent: 2, failed: 0 })
    })

    it('запрашивает только active/trialing с email_notifications_enabled=true', async () => {
      await sendNewPostNotification(VALID_POST)

      expect(mockAdminIn).toHaveBeenCalledWith('subscription_status', ['active', 'trialing'])
      expect(mockAdminEq).toHaveBeenCalledWith('email_notifications_enabled', true)
    })

    it('формирует subject и URL поста через /feed/', async () => {
      await sendNewPostNotification(VALID_POST)

      const [messages] = mockSendEmailBatch.mock.calls[0] as [
        Array<{ subject: string; html: string }>,
      ]
      expect(messages[0].subject).toBe('Nova objava: Test Post Title')
      expect(messages[0].html).toContain(`/feed/${VALID_UUID}`)
    })

    it('генерирует уникальный signed unsubscribe URL + List-Unsubscribe заголовки', async () => {
      await sendNewPostNotification(VALID_POST)

      const [messages] = mockSendEmailBatch.mock.calls[0] as [
        Array<{ html: string; headers?: Record<string, string> }>,
      ]
      expect(messages[0].html).toContain('/api/email/unsubscribe')
      expect(messages[0].headers?.['List-Unsubscribe']).toMatch(
        /^<https:\/\/.*\/api\/email\/unsubscribe/
      )
      expect(messages[0].headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')

      const uid1 = new URL(
        `https://x/${messages[0].html.match(/api\/email\/unsubscribe\?[^"]+/)?.[0]}`
      ).searchParams.get('uid')
      const uid2 = new URL(
        `https://x/${messages[1].html.match(/api\/email\/unsubscribe\?[^"]+/)?.[0]}`
      ).searchParams.get('uid')
      expect(uid1).toBe('11111111-1111-1111-1111-111111111111')
      expect(uid2).toBe('22222222-2222-2222-2222-222222222222')
    })

    it('фильтрует подписчиков с null/пустым/невалидным email', async () => {
      mockAdminRange.mockResolvedValue({
        data: [
          { id: '11111111-1111-1111-1111-111111111111', email: 'valid@example.com', display_name: 'Valid' },
          { id: '22222222-2222-2222-2222-222222222222', email: null, display_name: 'No Email' },
          { id: '33333333-3333-3333-3333-333333333333', email: '', display_name: 'Empty' },
          { id: '44444444-4444-4444-4444-444444444444', email: 'notanemail', display_name: 'No At' },
        ],
        error: null,
      })
      mockSendEmailBatch.mockResolvedValue({ sent: 1, failed: 0 })

      await sendNewPostNotification(VALID_POST)

      const [messages] = mockSendEmailBatch.mock.calls[0] as [unknown[]]
      expect(messages).toHaveLength(1)
    })

    it('возвращает { sent: 0, failed: 0 } и не вызывает batch без подписчиков', async () => {
      mockAdminRange.mockResolvedValue({ data: [], error: null })

      const result = await sendNewPostNotification(VALID_POST)

      expect(result).toEqual({ sent: 0, failed: 0 })
      expect(mockSendEmailBatch).not.toHaveBeenCalled()
    })

    it('санитизирует CRLF в заголовке (защита от header injection)', async () => {
      await sendNewPostNotification({ id: VALID_UUID, title: 'Title\r\nBcc: evil@x.com' })

      const [messages] = mockSendEmailBatch.mock.calls[0] as [Array<{ subject: string }>]
      expect(messages[0].subject).toBe('Nova objava: TitleBcc: evil@x.com')
    })

    it('non-string excerpt обрабатывается как absent (без TypeError)', async () => {
      const result = await sendNewPostNotification({
        id: VALID_UUID,
        title: 'Test',
        // @ts-expect-error — намеренно невалидный тип для проверки runtime-устойчивости
        excerpt: 123,
      })
      expect(result).toEqual({ sent: 2, failed: 0 })
    })

    it('нормализует trailing slashes в SITE_URL', async () => {
      vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.procontent.si//')
      await sendNewPostNotification(VALID_POST)

      const [messages] = mockSendEmailBatch.mock.calls[0] as [Array<{ html: string }>]
      expect(messages[0].html).not.toContain('//feed/')
      expect(messages[0].html).toContain('/feed/')
    })
  })

  describe('Контракт ошибок: partial-fail возвращает, hard-ошибки бросают', () => {
    it('partial-fail возвращает { sent, failed } без throw', async () => {
      mockSendEmailBatch.mockResolvedValue({ sent: 1, failed: 1 })

      const result = await sendNewPostNotification(VALID_POST)
      expect(result).toEqual({ sent: 1, failed: 1 })
    })

    it('бросает при отсутствии NEXT_PUBLIC_SITE_URL (batch не вызван)', async () => {
      vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')

      await expect(sendNewPostNotification(VALID_POST)).rejects.toThrow(/NEXT_PUBLIC_SITE_URL/)
      expect(mockSendEmailBatch).not.toHaveBeenCalled()
    })

    it('бросает при отсутствии NOTIFICATION_API_SECRET (batch не вызван)', async () => {
      vi.stubEnv('NOTIFICATION_API_SECRET', '')

      await expect(sendNewPostNotification(VALID_POST)).rejects.toThrow(/NOTIFICATION_API_SECRET/)
      expect(mockSendEmailBatch).not.toHaveBeenCalled()
    })

    it('бросает при whitespace-only NOTIFICATION_API_SECRET', async () => {
      vi.stubEnv('NOTIFICATION_API_SECRET', '   ')

      await expect(sendNewPostNotification(VALID_POST)).rejects.toThrow(/NOTIFICATION_API_SECRET/)
    })

    it('бросает при отсутствии Supabase env vars', async () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')

      await expect(sendNewPostNotification(VALID_POST)).rejects.toThrow(/Supabase env vars/)
    })

    it('бросает при ошибке запроса к БД (загрузка подписчиков)', async () => {
      mockAdminRange.mockResolvedValue({ data: null, error: { message: 'DB error' } })

      await expect(sendNewPostNotification(VALID_POST)).rejects.toThrow(/subscribers/)
      expect(mockSendEmailBatch).not.toHaveBeenCalled()
    })

    it('пробрасывает ошибку sendEmailBatch (hard Resend-ошибка)', async () => {
      mockSendEmailBatch.mockRejectedValue(new Error('RESEND_API_KEY is not configured'))

      await expect(sendNewPostNotification(VALID_POST)).rejects.toThrow(/RESEND_API_KEY/)
    })
  })

  describe('Pagination', () => {
    it('не делает лишний запрос при количестве строк кратном PAGE_SIZE', async () => {
      const exactPage = Array.from({ length: PAGE_SIZE }, (_, i) => ({
        id: `${i.toString().padStart(8, '0')}-0000-0000-0000-000000000000`,
        email: `user${i}@example.com`,
        display_name: null,
      }))
      mockAdminRange.mockResolvedValueOnce({ data: exactPage, error: null })
      mockSendEmailBatch.mockResolvedValue({ sent: PAGE_SIZE, failed: 0 })

      await sendNewPostNotification(VALID_POST)

      expect(mockAdminRange).toHaveBeenCalledTimes(1)
      expect(mockAdminRange).toHaveBeenNthCalledWith(1, 0, PAGE_SIZE)
    })

    it('запрашивает вторую страницу, когда первая вернула PAGE_SIZE+1 строк', async () => {
      const page1 = Array.from({ length: PAGE_SIZE + 1 }, (_, i) => ({
        id: `${i.toString().padStart(8, '0')}-0000-0000-0000-000000000000`,
        email: `user${i}@example.com`,
        display_name: null,
      }))
      const page2 = [
        { id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', email: 'last@example.com', display_name: 'Last' },
      ]
      mockAdminRange
        .mockResolvedValueOnce({ data: page1, error: null })
        .mockResolvedValueOnce({ data: page2, error: null })
      mockSendEmailBatch.mockResolvedValue({ sent: PAGE_SIZE + 1, failed: 0 })

      await sendNewPostNotification(VALID_POST)

      expect(mockAdminRange).toHaveBeenCalledTimes(2)
      expect(mockAdminRange).toHaveBeenNthCalledWith(2, PAGE_SIZE, PAGE_SIZE * 2)
    })
  })
})
