export interface NewCommentEmailData {
  postTitle: string
  postUrl: string
  commenterName: string
  recipientName?: string | null
}

export function generateNewCommentEmailHtml(data: NewCommentEmailData): string {
  const { postTitle, postUrl, commenterName, recipientName } = data
  const greeting = recipientName ? `Pozdravljeni, ${escapeHtml(recipientName)}!` : 'Pozdravljeni!'

  return `<!DOCTYPE html>
<html lang="sl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Barlow+Condensed:wght@400;500&display=swap" rel="stylesheet" />
  <title>Nov komentar k objavi: ${escapeHtml(postTitle)}</title>
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
              <p style="margin:0 0 28px;font-size:15px;color:#6e6762;line-height:1.5;">${escapeHtml(commenterName)} je komentiral/-a vašo objavo:</p>

              <!-- Блок заголовка поста -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="border-left:2px solid #a75d4b;padding:14px 20px;">
                    <p style="margin:0;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:22px;font-weight:600;color:#1e1a16;line-height:1.35;">${escapeHtml(postTitle)}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA outline button -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border:1px solid #a75d4b;">
                    <a href="${sanitizeHref(postUrl)}"
                       style="display:inline-block;padding:14px 40px;color:#1e1a16;font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-size:12px;font-weight:500;letter-spacing:0.22em;text-transform:uppercase;text-decoration:none;">
                      Poglej komentar
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
                Prejemate ta e-mail, ker ste avtorica objave v klubu PROCONTENT.
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

export function generateNewCommentEmailText(data: NewCommentEmailData): string {
  const { postTitle, postUrl, commenterName, recipientName } = data
  const greeting = recipientName ? `Pozdravljeni, ${recipientName}!` : 'Pozdravljeni!'

  return `PROCONTENT

${greeting}

${commenterName} je komentiral/-a vašo objavo:

${postTitle}

Oglejte si objavo in komentar:
${postUrl}

---
Prejemate ta e-mail, ker ste avtorica objave v klubu PROCONTENT.
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

function sanitizeHref(url: string): string {
  const trimmed = url.trim()
  const lower = trimmed.toLowerCase()
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    return escapeHtml(trimmed)
  }
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return escapeHtml(trimmed)
  }
  return '#'
}
