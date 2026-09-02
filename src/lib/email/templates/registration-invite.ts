export interface RegistrationInviteEmailData {
  registerUrl: string
  recipientName?: string | null
}

export function generateRegistrationInviteEmailHtml(
  data: RegistrationInviteEmailData
): string {
  const { registerUrl, recipientName } = data
  const greeting = recipientName ? `Pozdravljeni, ${escapeHtml(recipientName)}!` : 'Pozdravljeni!'
  const safeHref = sanitizeHref(registerUrl)

  // Если ссылка не прошла санитайз, показывать её ещё и текстом бессмысленно:
  // кнопка уже ведёт в '#', а печать сырого значения только сбивает с толку.
  const fallbackLinkBlock =
    safeHref === '#'
      ? ''
      : `<p style="margin:24px 0 0;font-size:13px;color:#6e6762;line-height:1.6;">Če gumb ne deluje, odprite to povezavo:<br />
                <a href="${safeHref}" style="color:#a75d4b;text-decoration:underline;word-break:break-all;">${escapeHtml(registerUrl)}</a>
              </p>`

  return `<!DOCTYPE html>
<html lang="sl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Barlow+Condensed:wght@400;500&display=swap" rel="stylesheet" />
  <title>Dokončajte registracijo v klub PROCONTENT</title>
</head>
<body style="margin:0;padding:0;background-color:#fefdf8;font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fefdf8;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="460" cellpadding="0" cellspacing="0" style="max-width:460px;width:100%;">

          <!-- Шапка: wordmark -->
          <tr>
            <td style="padding-bottom:32px;border-bottom:1px solid #e5e1da;">
              <p style="margin:0;font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-size:11px;font-weight:500;letter-spacing:0.28em;text-transform:uppercase;color:#1e1a16;">PROCONTENT</p>
              <p style="margin:4px 0 0;font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#6e6762;">Skupnost za ustvarjalce vsebin</p>
            </td>
          </tr>

          <!-- Тело письма -->
          <tr>
            <td style="padding-top:32px;padding-bottom:28px;">

              <!-- Приветствие -->
              <p style="margin:0 0 6px;font-size:15px;color:#6e6762;line-height:1.5;">${greeting}</p>
              <p style="margin:0 0 28px;font-size:15px;color:#6e6762;line-height:1.5;">Vaše plačilo je bilo uspešno prejeto. Hvala, da ste se pridružili klubu.</p>

              <!-- Блок с ключевым действием -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td style="border-left:2px solid #a75d4b;padding:14px 20px;">
                    <p style="margin:0;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:22px;font-weight:600;color:#1e1a16;line-height:1.35;">Še zadnji korak: ustvarite geslo</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;font-size:15px;color:#6e6762;line-height:1.6;">Za vstop v klub potrebujete še geslo. Postopek traja manj kot minuto.</p>

              <!-- CTA outline button -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border:1px solid #a75d4b;">
                    <a href="${safeHref}"
                       style="display:inline-block;padding:14px 40px;color:#1e1a16;font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-size:12px;font-weight:500;letter-spacing:0.22em;text-transform:uppercase;text-decoration:none;">
                      Dokončaj registracijo
                    </a>
                  </td>
                </tr>
              </table>

              ${fallbackLinkBlock}

            </td>
          </tr>

          <!-- Подвал -->
          <tr>
            <td style="border-top:1px solid #e5e1da;padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#6e6762;line-height:1.6;">
                Ta povezava je namenjena samo vam — prosimo, da je ne posredujete naprej.<br />
                To sporočilo ste prejeli, ker je bilo z vašim e-naslovom opravljeno plačilo članarine PROCONTENT.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function generateRegistrationInviteEmailText(
  data: RegistrationInviteEmailData
): string {
  const { registerUrl, recipientName } = data
  const greeting = recipientName ? `Pozdravljeni, ${recipientName}!` : 'Pozdravljeni!'

  return `PROCONTENT

${greeting}

Vaše plačilo je bilo uspešno prejeto. Hvala, da ste se pridružili klubu.

Še zadnji korak: ustvarite geslo
Za vstop v klub potrebujete še geslo. Postopek traja manj kot minuto.

${registerUrl}

---
Ta povezava je namenjena samo vam — prosimo, da je ne posredujete naprej.
To sporočilo ste prejeli, ker je bilo z vašim e-naslovom opravljeno plačilo članarine PROCONTENT.
`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Sanitizes a URL for use in href attributes.
 * Allows http:, https:, and root-relative paths (/path).
 * Blocks javascript: and protocol-relative (//host) URLs.
 */
function sanitizeHref(url: string): string {
  const trimmed = url.trim()
  const lower = trimmed.toLowerCase()
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    return escapeHtml(trimmed)
  }
  // Allow root-relative paths (/path) but not protocol-relative (//host)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return escapeHtml(trimmed)
  }
  return '#'
}
