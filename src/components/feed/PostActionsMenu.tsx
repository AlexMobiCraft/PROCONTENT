'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PostActionsMenuProps {
  canEdit?: boolean
  canDelete?: boolean
  editHref?: string
  onDelete?: () => Promise<void> | void
  triggerClassName?: string
  align?: 'left' | 'right'
}

export function PostActionsMenu({
  canEdit = false,
  canDelete = false,
  editHref,
  onDelete,
  triggerClassName,
  align = 'right',
}: PostActionsMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!rootRef.current) return
      const target = event.target as Node | null
      if (target && !rootRef.current.contains(target)) {
        setIsMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
        setIsConfirmOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  async function handleDeleteConfirm() {
    if (!onDelete || isDeleting) return

    setIsDeleting(true)
    try {
      await onDelete()
      setIsConfirmOpen(false)
      setIsMenuOpen(false)
    } finally {
      setIsDeleting(false)
    }
  }

  if (!canEdit && !canDelete) {
    return null
  }

  return (
    <div ref={rootRef} className="relative" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={() => setIsMenuOpen((value) => !value)}
        className={cn(
          'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          triggerClassName
        )}
        aria-label="Možnosti objave"
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        aria-controls={menuId}
      >
        <svg className="size-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path d="M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
        </svg>
      </button>

      {isMenuOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label="Možnosti objave"
          className={cn(
            'absolute top-full z-30 mt-2 min-w-[220px] overflow-hidden rounded-2xl border border-border bg-background shadow-[0_12px_40px_rgba(0,0,0,0.12)]',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          <div className="flex items-center gap-1 p-1">
            {canEdit && editHref ? (
              <Link
                href={editHref}
                role="menuitem"
                aria-label="Uredi objavo"
                title="Uredi objavo"
                className="flex size-11 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                onClick={() => setIsMenuOpen(false)}
              >
                <Pencil className="size-4" />
              </Link>
            ) : null}

            {canDelete ? (
              <button
                type="button"
                role="menuitem"
                aria-label="Izbriši objavo"
                title="Izbriši objavo"
                className="flex size-11 items-center justify-center rounded-xl text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                onClick={() => {
                  setIsMenuOpen(false)
                  setIsConfirmOpen(true)
                }}
              >
                <Trash2 className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
      )}

      {isConfirmOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${menuId}-title`}
            aria-describedby={`${menuId}-description`}
            className="w-full max-w-sm rounded-[1.5rem] border border-border bg-background p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
          >
            <div className="flex flex-col gap-2">
              <h3 id={`${menuId}-title`} className="font-heading text-xl font-semibold text-foreground">
                Izbris objave
              </h3>
              <p id={`${menuId}-description`} className="text-sm leading-relaxed text-muted-foreground">
                Ali res želite izbrisati to objavo? Tega dejanja ni mogoče razveljaviti.
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isDeleting}
              >
                Prekliči
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => void handleDeleteConfirm()}
                disabled={isDeleting}
              >
                {isDeleting ? 'Brisanje…' : 'Izbriši'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
