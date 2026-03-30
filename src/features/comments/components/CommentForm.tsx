'use client'

import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface CommentFormProps {
  onSubmit: (content: string) => void | Promise<void>
  /** ID родительского комментария для ответов */
  parentId?: string | null
  placeholder?: string
  autoFocus?: boolean
  formId?: string
  showSubmitButton?: boolean
}

export function CommentForm({
  onSubmit,
  placeholder = 'Napišite komentar...',
  autoFocus = false,
  formId,
  showSubmitButton = true,
}: CommentFormProps) {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEmpty = !content.trim()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isEmpty || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onSubmit(content.trim())
      setContent('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={3}
        className={cn(
          'w-full resize-none rounded-lg border border-border bg-background px-3 py-2',
          'text-sm text-foreground placeholder:text-muted-foreground',
          'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30'
        )}
      />
      {showSubmitButton ? (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isEmpty || isSubmitting}
            className={cn(
              'inline-flex min-h-[44px] items-center gap-2 border border-primary px-8 py-3 font-sans text-xs font-medium uppercase tracking-[0.2em] text-foreground',
              'transition-colors hover:bg-primary/10',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            <span>{isSubmitting ? 'Pošiljanje...' : 'Pošlji'}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </form>
  )
}
