'use client'

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
              'flex size-11 items-center justify-center border border-primary bg-transparent font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-foreground',
              'transition-colors hover:bg-primary/10',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            {isSubmitting ? 'Pošiljanje...' : 'Pošlji'}
          </button>
        </div>
      ) : null}
    </form>
  )
}
