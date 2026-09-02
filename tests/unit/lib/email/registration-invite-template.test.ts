import { describe, expect, it } from 'vitest'
import {
  generateRegistrationInviteEmailHtml,
  generateRegistrationInviteEmailText,
} from '@/lib/email/templates/registration-invite'

const REGISTER_URL = 'https://www.procontent.si/register?session_id=cs_live_abc123'

describe('registration-invite template', () => {
  it('вставляет ссылку на регистрацию в кнопку и в запасную строку', () => {
    const html = generateRegistrationInviteEmailHtml({ registerUrl: REGISTER_URL })

    // & в query-строке экранируется, поэтому проверяем базовую часть
    expect(html).toContain('https://www.procontent.si/register?session_id=cs_live_abc123')
    expect(html).toContain('Dokončaj registracijo')
    expect(generateRegistrationInviteEmailText({ registerUrl: REGISTER_URL })).toContain(
      REGISTER_URL
    )
  })

  it('здоровается без имени, если оно не передано', () => {
    const html = generateRegistrationInviteEmailHtml({ registerUrl: REGISTER_URL })
    expect(html).toContain('Pozdravljeni!')
  })

  // recipientName приходит из customer_details.name — свободного поля, которое
  // заполняет плательщик в Stripe. В HTML письма оно попадать неэкранированным не должно.
  it('экранирует имя получательницы в HTML', () => {
    const html = generateRegistrationInviteEmailHtml({
      registerUrl: REGISTER_URL,
      recipientName: '<script>alert("xss")</script>',
    })

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  // sanitizeHref молча отдаёт '#', если URL без схемы. Ссылка обязана быть проверена
  // до шаблона (в sendRegistrationInvite), но фиксируем и само поведение шаблона.
  it('заменяет небезопасную ссылку на # вместо подстановки', () => {
    const html = generateRegistrationInviteEmailHtml({
      registerUrl: 'javascript:alert(1)',
    })

    expect(html).not.toContain('javascript:alert(1)')
    expect(html).toContain('href="#"')
  })

  it('HTML и текстовая версия несут одинаковое ключевое сообщение', () => {
    const data = { registerUrl: REGISTER_URL }
    const html = generateRegistrationInviteEmailHtml(data)
    const text = generateRegistrationInviteEmailText(data)

    for (const phrase of [
      'Vaše plačilo je bilo uspešno prejeto',
      'Še zadnji korak: ustvarite geslo',
      'Postopek traja manj kot minuto',
    ]) {
      expect(html).toContain(phrase)
      expect(text).toContain(phrase)
    }
  })
})
