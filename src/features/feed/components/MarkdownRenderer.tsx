'use client'

import { Component, useMemo, type ReactNode } from 'react'
import { sanitizeHtml } from '@/lib/markdown'

interface MarkdownRendererProps {
  content: string
}

interface MarkdownRendererBoundaryProps {
  children: ReactNode
  fallback: ReactNode
}

interface MarkdownRendererBoundaryState {
  hasError: boolean
}

class MarkdownRendererBoundary extends Component<
  MarkdownRendererBoundaryProps,
  MarkdownRendererBoundaryState
> {
  state: MarkdownRendererBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError(): MarkdownRendererBoundaryState {
    return { hasError: true }
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback
    }

    return this.props.children
  }
}

function MarkdownRendererContent({ content }: MarkdownRendererProps) {
  const sanitized = useMemo(() => sanitizeHtml(content), [content])

  return (
    <div
      className="rich-content [&_figure[data-align='center']]:mx-auto [&_figure[data-align='left']]:mr-auto [&_figure[data-align='right']]:ml-auto [&_figure[data-type='inline-image']]:my-4 [&_figure[data-type='inline-image']]:space-y-2 [&_figure[data-type='inline-image']_img]:rounded-lg [&_figure[data-type='inline-image']_img]:border [&_figure[data-type='inline-image']_img]:border-border"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <MarkdownRendererBoundary
      fallback={<div className="rich-content"><p>Vsebina trenutno ni na voljo.</p></div>}
    >
      <MarkdownRendererContent content={content} />
    </MarkdownRendererBoundary>
  )
}
