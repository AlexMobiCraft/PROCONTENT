'use client'

import Link from 'next/link'
import { Camera, FileText, Video } from 'lucide-react'

type ContentType = 'video' | 'photo' | 'text'

interface OnboardingPostCardProps {
  id: string
  title: string
  category: string
  type: string
}

const typeConfig: Record<ContentType, { icon: typeof Video; label: string }> = {
  video: { icon: Video, label: 'Video' },
  photo: { icon: Camera, label: 'Fotografija' },
  text: { icon: FileText, label: 'Besedilo' },
}

function resolveTypeConfig(type: string): { icon: typeof Video; label: string } {
  if (type in typeConfig) return typeConfig[type as ContentType]
  // gallery / multi-video → показываем Camera как fallback
  if (type === 'gallery') return { icon: Camera, label: 'Galerija' }
  if (type === 'multi-video') return { icon: Video, label: 'Več videoposnetkov' }
  return typeConfig.text
}

export function OnboardingPostCard({ id, title, category, type }: OnboardingPostCardProps) {
  const { icon: Icon, label } = resolveTypeConfig(type)

  return (
    <Link
      href={`/feed/${id}`}
      aria-label={`Pojdi na objavo: ${title}`}
      className="flex min-h-[44px] items-center gap-3 border-b border-border py-4 transition-colors first:border-t hover:bg-muted/30"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="font-heading text-base font-semibold leading-snug text-foreground">
          {title}
        </span>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-muted px-3 py-1 font-sans text-xs text-muted-foreground">
            {category}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 font-sans text-xs text-muted-foreground">
            <Icon className="h-3 w-3" aria-hidden="true" />
            {label}
          </span>
        </div>
      </div>
    </Link>
  )
}
