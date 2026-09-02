import { sendEmailBatch, type BatchSendResult } from '@/lib/email'
import {
  generateRegistrationInviteEmailHtml,
  generateRegistrationInviteEmailText,
} from '@/lib/email/templates/registration-invite'

export interface RegistrationInviteInput {
  email: string
  sessionId: string
  recipientName?: string | null
}

export type RegistrationInviteResult =
  | BatchSendResult
  | { skipped: 'no_email' }
  | { skipped: 'no_session_id' }

/**
 * Отправляет письмо со ссылкой на завершение регистрации после успешной оплаты.
 *
 * Ссылка ведёт на `/register?session_id=…` — ту же страницу, куда Stripe редиректит
 * после checkout. Сессия Stripe читается через API бессрочно, поэтому ссылка не
 * протухает: клиентка, закрывшая вкладку сразу после оплаты, доходит до аккаунта.
 *
 * Контракт:
 *   - пустой/битый email → { skipped: 'no_email' }
 *   - пустой sessionId → { skipped: 'no_session_id' }
 *   - отказ Resend → { sent: 0, failed: 1 } БЕЗ броска (sendEmailBatch не бросает
 *     на ошибке доставки — только на отсутствующей конфигурации). Вызывающий обязан
 *     проверить `failed`, иначе потеря письма пройдёт молча.
 *   - успешная отправка → { sent, failed }
 *   - hard-ошибки конфигурации (нет NEXT_PUBLIC_SITE_URL / RESEND_API_KEY /
 *     RESEND_FROM_EMAIL) → бросает исключение
 */
export async function sendRegistrationInvite(
  input: RegistrationInviteInput
): Promise<RegistrationInviteResult> {
  // --- env-guard (вне try/catch) ---
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (!siteUrl) {
    throw new Error('[notifications] NEXT_PUBLIC_SITE_URL is not configured')
  }

  // Без схемы sanitizeHref в шаблоне тихо превратит ссылку в '#': письмо уйдёт,
  // Resend отчитается об успехе, а единственная кнопка не поведёт никуда.
  if (!/^https?:\/\//i.test(siteUrl.trim())) {
    throw new Error(
      '[notifications] NEXT_PUBLIC_SITE_URL must be an absolute http(s) URL'
    )
  }

  const email = input.email?.trim()
  if (!email || !email.includes('@')) {
    return { skipped: 'no_email' }
  }

  const sessionId = input.sessionId?.trim()
  if (!sessionId) {
    return { skipped: 'no_session_id' }
  }

  const normalizedSiteUrl = siteUrl.replace(/\/+$/, '')
  const registerUrl = `${normalizedSiteUrl}/register?session_id=${encodeURIComponent(sessionId)}`
  // customer_details.name — свободный текст, который вводит плательщик в Stripe.
  // Экранирование делает шаблон; здесь ограничиваем длину, чтобы приветствие не разъехалось.
  const recipientName =
    input.recipientName?.replace(/[\r\n]/g, '').trim().slice(0, 80) || null

  const message = {
    to: email,
    subject: 'Dobrodošli v PROCONTENT — dokončajte registracijo',
    html: generateRegistrationInviteEmailHtml({ registerUrl, recipientName }),
    text: generateRegistrationInviteEmailText({ registerUrl, recipientName }),
  }

  return sendEmailBatch([message])
}
