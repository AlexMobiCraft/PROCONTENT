'use client'

import Link from 'next/link'
import { Camera, FileText, Video } from 'lucide-react'

type ContentType = 'video' | 'photo' | 'text'

interface OnboardingPostCardProps {
  id: string
  title: string
  category: string
  type: ContentType
}

const typeConfig: Record<ContentType, { icon: typeof Video; label: string }> = {
  video: { icon: Video, label: 'Видео' },
  photo: { icon: Camera, label: 'Фото' },
  text: { icon: FileText, label: 'Текст' },
}

export function OnboardingPostCard({ title, category, type }: OnboardingPostCardProps) {
  const { icon: Icon, label } = typeConfig[type]

  return (
    <Link
      href="/feed"
      aria-label={`Перейти к посту: ${title}`}
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
