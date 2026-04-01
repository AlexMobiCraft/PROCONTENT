'use client'

import { useForm } from 'react-hook-form'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/features/auth/store'
import { MediaUploader } from './MediaUploader'
import { createPost, updatePost } from '@/features/admin/api/posts'
import { getCategories, type Category } from '@/features/admin/api/categories'
import {
  PostFormSchema,
  MAX_MEDIA_FILES,
  MAX_LANDING_PREVIEW,
  MAX_ONBOARDING_POSTS,
  type PostFormValues,
  type MediaItem,
  type NewMediaItem,
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
  type?: string
  status?: string
  scheduled_at?: string | null
  published_at?: string | null
  is_landing_preview?: boolean
  is_onboarding?: boolean
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

  // Track ObjectURLs for cleanup on unmount
  const objectUrlsRef = useRef<Set<string>>(new Set())

  const handleMediaChange = (items: MediaItem[]) => {
    // Track new ObjectURLs and clean up revoked ones
    const currentUrls = new Set(
      items
        .filter((i): i is NewMediaItem => i.kind === 'new')
        .map((i) => i.preview_url)
    )
    // Revoke URLs no longer in the list
    for (const url of objectUrlsRef.current) {
      if (!currentUrls.has(url)) {
        URL.revokeObjectURL(url)
        objectUrlsRef.current.delete(url)
      }
    }
    // Track new URLs
    for (const url of currentUrls) {
      objectUrlsRef.current.add(url)
    }
    setMediaItems(items)
  }

  // Cleanup ObjectURLs on unmount — snapshot the ref to avoid double-revoke
  useEffect(() => {
    const ref = objectUrlsRef.current
    return () => {
      if (!(ref instanceof Set)) return
      const urls = new Set(ref)
      ref.clear()
      for (const url of urls) {
        URL.revokeObjectURL(url)
      }
    }
  }, [])

  const [mediaError, setMediaError] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true)
  const hasSetCategoryRef = useRef(false)

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => toast.error('Napaka pri nalaganju kategorij'))
      .finally(() => setIsCategoriesLoading(false))
  }, [])

  // In edit mode, sync the category value after options are rendered.
  // Guard with ref to prevent double-call if categories state updates more than once.
  const categoriesLength = categories.length
  useEffect(() => {
    if (!hasSetCategoryRef.current && categoriesLength > 0 && isEditMode && initialData?.category) {
      hasSetCategoryRef.current = true
      setValue('category', initialData.category)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriesLength])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PostFormValues>({
    defaultValues: {
      title: initialData?.title ?? '',
      content: initialData?.content ?? '',
      excerpt: initialData?.excerpt ?? '',
      category: initialData?.category ?? '',
      is_landing_preview: initialData?.is_landing_preview ?? false,
      is_onboarding: initialData?.is_onboarding ?? false,
    },
  })

  const isLandingPreview = watch('is_landing_preview')
  const isOnboarding = watch('is_onboarding')

  async function onSubmit(values: PostFormValues) {
    // Validate with Zod (react-hook-form handles required/max, but Zod is authoritative)
    const parsed = PostFormSchema.safeParse(values)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? 'Napaka pri validaciji'
      toast.error(firstError)
      return
    }

    // Validate media: at most MAX_MEDIA_FILES
    if (mediaItems.length > MAX_MEDIA_FILES) {
      setMediaError(`Največ ${MAX_MEDIA_FILES} datotek je dovoljenih`)
      return
    }
    setMediaError(null)

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
        <select
          id="category"
          aria-label="Kategorija"
          {...register('category', { required: 'Kategorija je obvezna' })}
          disabled={isSubmitting || isCategoriesLoading}
          aria-invalid={!!errors.category}
          className="flex w-full rounded-xl border border-border bg-muted/50 px-3 py-3 text-sm text-foreground transition-colors focus-visible:border-primary focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:pointer-events-none disabled:opacity-50 min-h-[44px]"
        >
          <option value="">
            {isCategoriesLoading ? 'Nalaganje...' : 'Izberite kategorijo'}
          </option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.slug}>
              {cat.name}
            </option>
          ))}
        </select>
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
        <MediaUploader items={mediaItems} onChange={handleMediaChange} isSubmitting={isSubmitting} />
        {mediaError && (
          <p className="text-xs text-destructive" role="alert" data-testid="media-required-error">
            {mediaError}
          </p>
        )}
      </div>

      {/* Curation toggles */}
      <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <span className="text-sm font-medium">Upravljanje vsebine</span>

        <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            aria-label="Prikaži na začetni strani"
            {...register('is_landing_preview')}
            disabled={isSubmitting}
            className="h-4 w-4 accent-primary"
          />
          <div className="flex flex-col">
            <span className="text-sm">Predogled na začetni strani</span>
            <span className="text-xs text-muted-foreground">
              Največ {MAX_LANDING_PREVIEW} objave hkrati
            </span>
          </div>
        </label>

        <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            aria-label="Dodaj v uvajanje novih članic"
            {...register('is_onboarding')}
            disabled={isSubmitting}
            className="h-4 w-4 accent-primary"
          />
          <div className="flex flex-col">
            <span className="text-sm">Uvajanje novih članic (Top-{MAX_ONBOARDING_POSTS})</span>
            <span className="text-xs text-muted-foreground">
              Največ {MAX_ONBOARDING_POSTS} objav hkrati
            </span>
          </div>
        </label>

        {(isLandingPreview || isOnboarding) && (
          <p className="text-xs text-muted-foreground">
            {[
              isLandingPreview && 'predogled na začetni strani',
              isOnboarding && 'uvajanje novih članic',
            ]
              .filter(Boolean)
              .join(' in ')
              .replace(/^./, (s) => s.toUpperCase())}
          </p>
        )}
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
