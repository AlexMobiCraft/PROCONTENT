'use client'

import { sanitizeHtml } from '@/lib/markdown'

interface MarkdownRendererProps {
  content: string
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const sanitized = sanitizeHtml(content)

  return (
    <div
      className="rich-content [&_figure[data-align='center']]:mx-auto [&_figure[data-align='left']]:mr-auto [&_figure[data-align='right']]:ml-auto [&_figure[data-type='inline-image']]:my-4 [&_figure[data-type='inline-image']]:space-y-2 [&_figure[data-type='inline-image']_img]:rounded-lg [&_figure[data-type='inline-image']_img]:border [&_figure[data-type='inline-image']_img]:border-border"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
