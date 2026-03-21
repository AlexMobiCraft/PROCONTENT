'use client'

interface PostCommentsPanelProps {
  selectedPostId: string | null
  onClose: () => void
}

const ChatBubbleIcon = () => (
  <svg
    className="size-7"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
    aria-hidden
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
    />
  </svg>
)

export function PostCommentsPanel({ selectedPostId, onClose }: PostCommentsPanelProps) {
  if (!selectedPostId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 py-16 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <ChatBubbleIcon />
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-heading text-base font-semibold text-foreground">Komentarji</p>
          <p className="text-sm text-muted-foreground">
            Izberite objavo za ogled komentarjev
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
          Komentarji
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zapri komentarje"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg
            className="size-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Placeholder */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-16 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <ChatBubbleIcon />
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-heading text-base font-semibold text-foreground">
            Komentarji kmalu
          </p>
          <p className="text-sm text-muted-foreground">Funkcija je v razvoju</p>
        </div>
      </div>
    </div>
  )
}
