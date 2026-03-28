import { Resend } from 'resend'

let _resend: Resend | null = null

function getResendClient(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error('[email] RESEND_API_KEY is not configured')
    }
    _resend = new Resend(apiKey)
  }
  return _resend
}

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
  headers?: Record<string, string>
}

export interface BatchSendResult {
  sent: number
  failed: number
}

/**
 * Отправляет пакет писем за один HTTP-запрос через Resend Batch API.
 * Максимум 100 писем за вызов (ограничение Resend).
 */
export async function sendEmailBatch(messages: EmailMessage[]): Promise<BatchSendResult> {
  if (messages.length === 0) return { sent: 0, failed: 0 }

  const from = process.env.RESEND_FROM_EMAIL
  if (!from) {
    throw new Error('[email] RESEND_FROM_EMAIL is not configured')
  }

  const resend = getResendClient()
  const BATCH_SIZE = 100

  let sent = 0
  let failed = 0

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const chunk = messages.slice(i, i + BATCH_SIZE)
    const { data, error } = await resend.batch.send(
      chunk.map((msg) => ({
        from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        ...(msg.headers ? { headers: msg.headers } : {}),
      }))
    )

    if (error) {
      console.error('[email] Batch send error:', error)
      failed += chunk.length
    } else {
      const succeededCount = data?.data?.length ?? 0
      sent += succeededCount
      failed += chunk.length - succeededCount
    }
  }

  return { sent, failed }
}
