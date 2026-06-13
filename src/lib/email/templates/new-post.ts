export interface NewPostEmailData {
  postTitle: string
  postUrl: string
  postExcerpt?: string | null
  recipientName?: string | null
  unsubscribeUrl: string
}

export function generateNewPostEmailHtml(data: NewPostEmailData): string {
  const { postTitle, postUrl, postExcerpt, recipientName, unsubscribeUrl } = data
  const greeting = recipientName ? `Pozdravljeni, ${escapeHtml(recipientName)}!` : 'Pozdravljeni!'
  const excerptBlock = postExcerpt
    ? `<p style="margin:0 0 24px;font-size:15px;color:#6e6762;line-height:1.6;">${escapeHtml(postExcerpt)}</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="sl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Barlow+Condensed:wght@400;500&display=swap" rel="stylesheet" />
  <title>Nova objava: ${escapeHtml(postTitle)}</title>
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
              <p style="margin:0 0 28px;font-size:15px;color:#6e6762;line-height:1.5;">Objavili smo novo vsebino, ki jo ne smete zamuditi:</p>

              <!-- Блок заголовка поста -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:${postExcerpt ? '20px' : '28px'};">
                <tr>
                  <td style="border-left:2px solid #a75d4b;padding:14px 20px;">
                    <p style="margin:0;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:22px;font-weight:600;color:#1e1a16;line-height:1.35;">${escapeHtml(postTitle)}</p>
                  </td>
                </tr>
              </table>

              <!-- Excerpt -->
              ${excerptBlock}

              <!-- CTA outline button -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border:1px solid #a75d4b;">
                    <a href="${sanitizeHref(postUrl)}"
                       style="display:inline-block;padding:14px 40px;color:#1e1a16;font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-size:12px;font-weight:500;letter-spacing:0.22em;text-transform:uppercase;text-decoration:none;">
                      Preberi objavo
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Подвал -->
          <tr>
            <td style="border-top:1px solid #e5e1da;padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#6e6762;line-height:1.6;">
                Prejemate ta e-mail, ker ste aktivna članica kluba PROCONTENT.<br />
                Če ne želite prejemati obvestil o novih objavah,
                <a href="${sanitizeHref(unsubscribeUrl)}" style="color:#a75d4b;text-decoration:underline;">se odjavite tukaj</a>.
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
  const { postTitle, postUrl, postExcerpt, recipientName, unsubscribeUrl } = data
  const greeting = recipientName ? `Pozdravljeni, ${recipientName}!` : 'Pozdravljeni!'
  const excerptSection = postExcerpt ? `\n${postExcerpt}\n` : ''

  return `PROCONTENT

${greeting}

${postTitle}
${excerptSection}
V klubu je nova objava — preberite jo zdaj:
${postUrl}

---
Če ne želite prejemati obvestil o novih objavah, se odjavite tukaj:
${unsubscribeUrl}
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
