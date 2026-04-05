'use client'

import Image from 'next/image'
import type { EditorContentValue, MediaItem } from '@/features/admin/types'

interface PostComposerPreviewProps {
  title: string
  excerpt: string
  gallery: MediaItem[]
  editor: EditorContentValue
  warning: string | null
}

export function PostComposerPreview({
  title,
  excerpt,
  gallery,
  editor,
  warning,
}: PostComposerPreviewProps) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">Predogled objave</h2>
        <p className="text-xs text-muted-foreground">
          Galerija je vedno prikazana nad vsebino članka.
        </p>
      </div>

      {warning && (
        <div
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900"
          role="status"
        >
          {warning}
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-lg bg-muted/30 p-4">
        <div className="flex flex-col gap-2">
          <h3 className="font-heading text-xl font-semibold">{title || 'Naslov objave'}</h3>
          {excerpt ? <p className="text-sm text-muted-foreground">{excerpt}</p> : null}
        </div>

        {gallery.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2" data-testid="preview-gallery">
            {gallery.map((item) => {
              const src = item.kind === 'new' ? item.preview_url : item.url

              if (!src) {
                return null
              }

              return (
                <div
                  key={item.kind === 'new' ? item.key : item.id}
                  className="aspect-[4/3] rounded-lg border border-border bg-background/80"
                >
                  <Image
                    src={src}
                    alt=""
                    width={1200}
                    height={900}
                    unoptimized
                    className="h-full w-full rounded-lg object-cover"
                  />
                </div>
              )
            })}
          </div>
        ) : null}

        <article
          className="prose prose-sm max-w-none"
          data-testid="preview-article"
          dangerouslySetInnerHTML={{
            __html: editor.html || '<p class="text-muted-foreground">Besedilo objave bo prikazano tukaj.</p>',
          }}
        />
      </div>
    </section>
  )
}
