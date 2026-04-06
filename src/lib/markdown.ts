import DOMPurify from 'dompurify'

const ALLOWED_TAGS = [
  'p',
  'strong',
  'em',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'h2',
  'h3',
  'h4',
  'img',
  'code',
  'pre',
  'blockquote',
  'a',
  'br',
  'figure',
  'figcaption',
]

const ALLOWED_ATTR = [
  'src',
  'alt',
  'href',
  'class',
  'data-type',
  'data-align',
  'data-upload-id',
  'data-storage-bucket',
  'loading',
  'width',
  'height',
  'style',
  'target',
  'rel',
]

export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return html

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'IMG' && !node.hasAttribute('loading')) {
      node.setAttribute('loading', 'lazy')
    }
    if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer')
    }
  })

  const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })
  DOMPurify.removeHook('afterSanitizeAttributes')

  return clean
}
