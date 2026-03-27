export interface NewPostEmailData {
  postTitle: string
  postUrl: string
  recipientName?: string | null
  unsubscribeUrl: string
}

export function generateNewPostEmailHtml(data: NewPostEmailData): string {
  const { postTitle, postUrl, recipientName, unsubscribeUrl } = data
  const greeting = recipientName ? `Pozdravljeni, ${recipientName}!` : 'Pozdravljeni!'

  return `<!DOCTYPE html>
<html lang="sl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nova objava: ${escapeHtml(postTitle)}</title>
</head>
<body style="margin:0;padding:0;background-color:#faf8f5;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf8f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background-color:#c97d5b;padding:28px 40px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.02em;">PROCONTENT</p>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Skupnost za ustvarjalce vsebin</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:15px;color:#6b5e52;">${escapeHtml(greeting)}</p>
              <p style="margin:0 0 24px;font-size:15px;color:#3d2e22;line-height:1.6;">
                Objavili smo novo vsebino, ki jo ne smete zamuditi:
              </p>

              <!-- Post title block -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background-color:#faf8f5;border-left:4px solid #c97d5b;border-radius:4px;padding:16px 20px;">
                    <p style="margin:0;font-size:18px;font-weight:600;color:#3d2e22;line-height:1.4;">${escapeHtml(postTitle)}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#c97d5b;border-radius:8px;">
                    <a href="${sanitizeHref(postUrl)}"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                      Preberi objavo →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #f0ece6;">
              <p style="margin:0;font-size:12px;color:#9b8e83;line-height:1.6;">
                Prejemate to sporočilo, ker ste aktivni član skupnosti PROCONTENT.<br />
                Če ne želite prejemati teh obvestil, obiščite
                <a href="${sanitizeHref(unsubscribeUrl)}" style="color:#c97d5b;text-decoration:underline;">nastavitve e-pošte</a>.
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

export function generateNewPostEmailText(data: NewPostEmailData): string {
  const { postTitle, postUrl, recipientName, unsubscribeUrl } = data
  const greeting = recipientName ? `Pozdravljeni, ${recipientName}!` : 'Pozdravljeni!'

  return `${greeting}

Objavili smo novo vsebino:

${postTitle}

Preberite objavo: ${postUrl}

---
Odjava od obvestil: ${unsubscribeUrl}
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
 * Only allows http: and https: schemes to prevent javascript: injection.
 */
function sanitizeHref(url: string): string {
  const lower = url.trim().toLowerCase()
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
    return '#'
  }
  return escapeHtml(url)
}
