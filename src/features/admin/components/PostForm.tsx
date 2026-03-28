'use client'

import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/features/auth/store'
import { MediaUploader } from './MediaUploader'
import { createPost, updatePost } from '@/features/admin/api/posts'
import {
  PostFormSchema,
  type PostFormValues,
  type MediaItem,
  type ExistingMediaItem,
} from '@/features/admin/types'

type PostMediaRow = {
  id: string
  url: string
  thumbnail_url: string | null
  media_type: 'image' | 'video'
  order_index: number
  is_cover: boolean
}

interface InitialData {
  id: string
  title: string
  content?: string | null
  excerpt?: string | null
  category: string
  post_media?: PostMediaRow[]
}

type PostFormProps =
  | { mode: 'create' }
  | { mode: 'edit'; initialData: InitialData }

export function PostForm(props: PostFormProps) {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)

  const isEditMode = props.mode === 'edit'
  const initialData = isEditMode ? props.initialData : null

  // Initialize media items from existing post_media
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(() => {
    if (!initialData?.post_media) return []
    return [...initialData.post_media]
      .sort((a, b) => a.order_index - b.order_index)
      .map((m) => ({
        kind: 'existing' as const,
        id: m.id,
        url: m.url,
        thumbnail_url: m.thumbnail_url,
        media_type: m.media_type,
        is_cover: m.is_cover,
        order_index: m.order_index,
      }))
  })

  // Keep original media for edit mode (to detect deletions)
  const [originalMedia] = useState<ExistingMediaItem[]>(() => {
    if (!initialData?.post_media) return []
    return initialData.post_media.map((m) => ({
      kind: 'existing' as const,
      id: m.id,
      url: m.url,
      thumbnail_url: m.thumbnail_url,
      media_type: m.media_type,
      is_cover: m.is_cover,
      order_index: m.order_index,
    }))
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PostFormValues>({
    defaultValues: {
      title: initialData?.title ?? '',
      content: initialData?.content ?? '',
      excerpt: initialData?.excerpt ?? '',
      category: initialData?.category ?? '',
    },
  })

  async function onSubmit(values: PostFormValues) {
    // Validate with Zod (react-hook-form handles required/max, but Zod is authoritative)
    const parsed = PostFormSchema.safeParse(values)
    if (!parsed.success) return

    if (!user) {
      toast.error('Niste prijavljeni')
      return
    }

    try {
      if (isEditMode && initialData) {
        await updatePost({
          postId: initialData.id,
          formValues: parsed.data,
          mediaItems,
          originalMedia,
        })
        toast.success('Objava je bila posodobljena')
      } else {
        await createPost({
          formValues: parsed.data,
          mediaItems,
          authorId: user.id,
        })
        toast.success('Objava je bila objavljena')
      }
      router.push('/feed')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Napaka pri shranjevanju'
      toast.error(message)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium">
          Naslov
        </label>
        <Input
          id="title"
          aria-label="Naslov"
          {...register('title', {
            required: 'Naslov je obvezen',
            maxLength: { value: 255, message: 'Naslov je predolg (max 255 znakov)' },
          })}
          disabled={isSubmitting}
          aria-invalid={!!errors.title}
        />
        {errors.title && (
          <p className="text-xs text-destructive" role="alert">
            {errors.title.message}
          </p>
        )}
      </div>

      {/* Category */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="category" className="text-sm font-medium">
          Kategorija
        </label>
        <Input
          id="category"
          aria-label="Kategorija"
          {...register('category', { required: 'Kategorija je obvezna' })}
          disabled={isSubmitting}
          aria-invalid={!!errors.category}
        />
        {errors.category && (
          <p className="text-xs text-destructive" role="alert">
            {errors.category.message}
          </p>
        )}
      </div>

      {/* Excerpt */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="excerpt" className="text-sm font-medium">
          Povzetek
        </label>
        <Input
          id="excerpt"
          aria-label="Povzetek"
          {...register('excerpt', {
            maxLength: { value: 500, message: 'Povzetek je predolg (max 500 znakov)' },
          })}
          disabled={isSubmitting}
          aria-invalid={!!errors.excerpt}
        />
        {errors.excerpt && (
          <p className="text-xs text-destructive" role="alert">
            {errors.excerpt.message}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="content" className="text-sm font-medium">
          Vsebina
        </label>
        <textarea
          id="content"
          aria-label="Vsebina"
          {...register('content')}
          disabled={isSubmitting}
          rows={8}
          className="min-h-[44px] w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus-visible:ring-2 disabled:opacity-50"
        />
      </div>

      {/* Media uploader */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Mediji</span>
        <MediaUploader items={mediaItems} onChange={setMediaItems} isSubmitting={isSubmitting} />
      </div>

      {/* Submit */}
      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            <span>Shranjevanje...</span>
          </>
        ) : isEditMode ? (
          'Shrani'
        ) : (
          'Objavi'
        )}
      </Button>
    </form>
  )
}
