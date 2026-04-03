'use client'

import type { ScheduledPost } from '../types'

interface ScheduledPostsTableProps {
  posts: ScheduledPost[]
  isLoading: boolean
  actingIds: string[]
  onCancel: (id: string) => void
  onEdit: (id: string) => void
  onPublishNow: (id: string) => void
}

const dateFormatter = new Intl.DateTimeFormat('sl-SI', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short',
  timeZone: 'Europe/Ljubljana',
})

function formatScheduledAt(value: string | null): string {
  if (!value) return '—'
  return dateFormatter.format(new Date(value))
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border">
      <td className="px-4 py-3">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <div className="h-9 w-10 animate-pulse rounded bg-muted" />
          <div className="h-9 w-24 animate-pulse rounded bg-muted" />
          <div className="h-9 w-24 animate-pulse rounded bg-muted" />
        </div>
      </td>
    </tr>
  )
}

export function ScheduledPostsTable({
  posts,
  isLoading,
  actingIds,
  onCancel,
  onEdit,
  onPublishNow,
}: ScheduledPostsTableProps) {
  const tableHead = (
    <thead className="border-b border-border bg-muted/30">
      <tr>
        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Naslov</th>
        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Kategorija</th>
        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Načrtovano za</th>
        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Dejanja</th>
      </tr>
    </thead>
  )

  if (isLoading) {
    return (
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          {tableHead}
          <tbody>
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        {tableHead}
        <tbody>
          {posts.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                Ni načrtovanih objav.
              </td>
            </tr>
          ) : (
            posts.map((post) => {
              const isActing = actingIds.includes(post.id)
              return (
                <tr key={post.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{post.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{post.category}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatScheduledAt(post.scheduled_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Edit — Ghost/Icon button */}
                      <button
                        type="button"
                        onClick={() => onEdit(post.id)}
                        disabled={isActing}
                        aria-label={`Uredi objavo: ${post.title}`}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-50"
                      >
                        <svg
                          className="size-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                          aria-hidden
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                          />
                        </svg>
                      </button>

                      {/* Publish Now — Primary CTA outline */}
                      <button
                        type="button"
                        onClick={() => onPublishNow(post.id)}
                        disabled={isActing}
                        aria-label={`Objavi zdaj: ${post.title}`}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-primary px-3 font-sans text-xs font-medium tracking-[0.2em] uppercase transition-colors hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-50"
                      >
                        {isActing ? 'Objavljanje...' : 'Objavi zdaj'}
                      </button>

                      {/* Cancel — Destructive outline */}
                      <button
                        type="button"
                        onClick={() => onCancel(post.id)}
                        disabled={isActing}
                        aria-label={`Prekliči objavo: ${post.title}`}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-destructive px-3 font-sans text-xs font-medium tracking-[0.2em] uppercase text-destructive transition-colors hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
                      >
                        {isActing ? 'Preklic...' : 'Prekliči objavo'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
