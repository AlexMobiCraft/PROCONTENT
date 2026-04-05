'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/features/auth/store'
import { getCategories, type Category } from '@/features/admin/api/categories'
import { createPost, updatePost } from '@/features/admin/api/posts'
import { MediaUploader } from '@/features/admin/components/MediaUploader'
import { PostComposerPreview } from '@/features/admin/components/PostComposerPreview'
import {
  type EditorContentValue,
  type ExistingMediaItem,
  type MediaItem,
  type NewMediaItem,
  type PostFormValues,
  PostFormSchema,
  MAX_LANDING_PREVIEW,
  MAX_MEDIA_FILES,
  MAX_ONBOARDING_POSTS,
  createPostMetaState,
  getCompositionWarning,
  normalizeEditorContent,
} from '@/features/admin/types'
import { TiptapEditor } from '@/features/editor/components/TiptapEditor'
import { uploadInlineImage } from '@/features/editor/lib/uploadInlineImage'

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
  status?: 'draft' | 'scheduled' | 'published'
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
  const user = useAuthStore((state) => state.user)

  const isEditMode = props.mode === 'edit'
  const initialData = isEditMode ? props.initialData : null

  const [editorValue, setEditorValue] = useState<EditorContentValue>(() =>
    normalizeEditorContent(initialData?.content)
  )
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true)
  const [scheduledAtError, setScheduledAtError] = useState<string | null>(null)

  const objectUrlsRef = useRef<Set<string>>(new Set())
  const hasSetCategoryRef = useRef(false)

  const [mediaItems, setMediaItems] = useState<MediaItem[]>(() => {
    if (!initialData?.post_media) return []

    return [...initialData.post_media]
      .sort((left, right) => left.order_index - right.order_index)
      .map((item) => ({
        kind: 'existing' as const,
        id: item.id,
        url: item.url,
        thumbnail_url: item.thumbnail_url,
        media_type: item.media_type,
        is_cover: item.is_cover,
        order_index: item.order_index,
      }))
  })

  const [originalMedia] = useState<ExistingMediaItem[]>(() => {
    if (!initialData?.post_media) return []

    return initialData.post_media.map((item) => ({
      kind: 'existing' as const,
      id: item.id,
      url: item.url,
      thumbnail_url: item.thumbnail_url,
      media_type: item.media_type,
      is_cover: item.is_cover,
      order_index: item.order_index,
    }))
  })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PostFormValues>({
    defaultValues: {
      title: initialData?.title ?? '',
      content: normalizeEditorContent(initialData?.content).html,
      excerpt: initialData?.excerpt ?? '',
      category: initialData?.category ?? '',
      is_landing_preview: initialData?.is_landing_preview ?? false,
      is_onboarding: initialData?.is_onboarding ?? false,
      status: initialData?.status === 'scheduled' ? 'scheduled' : 'published',
      scheduled_at: initialData?.scheduled_at ?? null,
    },
  })

  const title = watch('title')
  const excerpt = watch('excerpt')
  const isLandingPreview = watch('is_landing_preview')
  const isOnboarding = watch('is_onboarding')
  const formStatus = watch('status')
  const scheduledAt = watch('scheduled_at')
  const isScheduledMode = formStatus === 'scheduled'
  const wasAlreadyPublished = isEditMode && Boolean(initialData?.published_at)

  const compositionWarning = getCompositionWarning(
    mediaItems.length,
    editorValue.inline_images_count
  )

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => toast.error('Napaka pri nalaganju kategorij'))
      .finally(() => setIsCategoriesLoading(false))
  }, [])

  useEffect(() => {
    const trackedUrls = objectUrlsRef.current

    return () => {
      const urls = [...trackedUrls]
      trackedUrls.clear()
      for (const url of urls) {
        URL.revokeObjectURL(url)
      }
    }
  }, [])

  useEffect(() => {
    if (
      hasSetCategoryRef.current ||
      categories.length === 0 ||
      !isEditMode ||
      !initialData?.category
    ) {
      return
    }

    hasSetCategoryRef.current = true
    setValue('category', initialData.category)
  }, [categories.length, initialData?.category, isEditMode, setValue])

  const localDatetimeValue = useMemo(() => {
    if (!scheduledAt) return ''

    const date = new Date(scheduledAt)
    const offset = date.getTimezoneOffset()
    const local = new Date(date.getTime() - offset * 60000)
    return local.toISOString().slice(0, 16)
  }, [scheduledAt])

  function handleMediaChange(nextItems: MediaItem[]) {
    const currentUrls = new Set(
      nextItems
        .filter((item): item is NewMediaItem => item.kind === 'new')
        .map((item) => item.preview_url)
    )

    for (const url of objectUrlsRef.current) {
      if (!currentUrls.has(url)) {
        URL.revokeObjectURL(url)
        objectUrlsRef.current.delete(url)
      }
    }

    for (const url of currentUrls) {
      objectUrlsRef.current.add(url)
    }

    setMediaItems(nextItems)
  }

  function getMinDatetime() {
    const date = new Date(Date.now() + 5 * 60_000)
    const offset = date.getTimezoneOffset()
    const local = new Date(date.getTime() - offset * 60000)
    return local.toISOString().slice(0, 16)
  }

  function formatSchedulePreview(utcIso: string) {
    const date = new Date(utcIso)
    const formatted = new Intl.DateTimeFormat('sl-SI', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(date)
    const timeZone =
      new Intl.DateTimeFormat('sl-SI', { timeZoneName: 'short' })
        .formatToParts(date)
        .find((part) => part.type === 'timeZoneName')?.value ?? ''

    return `Objava bo objavljena ${formatted} (${timeZone})`
  }

  function handleModeChange(mode: 'published' | 'scheduled') {
    setValue('status', mode)
    if (mode === 'published') {
      setValue('scheduled_at', null)
      setScheduledAtError(null)
    }
  }

  function handleDatetimeChange(localValue: string) {
    if (!localValue) {
      setValue('scheduled_at', null)
      return
    }

    setValue('scheduled_at', new Date(localValue).toISOString())
    setScheduledAtError(null)
  }

  async function onSubmit(values: PostFormValues) {
    const parsed = PostFormSchema.safeParse({
      ...values,
      content: editorValue.html,
    })

    if (!parsed.success) {
      const scheduledIssue = parsed.error.issues.find((issue) =>
        issue.path.includes('scheduled_at')
      )
      if (scheduledIssue) {
        setScheduledAtError(scheduledIssue.message)
      }

      const otherIssue = parsed.error.issues.find(
        (issue) => !issue.path.includes('scheduled_at')
      )
      if (otherIssue) {
        toast.error(otherIssue.message)
      }
      return
    }

    if (mediaItems.length > MAX_MEDIA_FILES) {
      setMediaError(`Največ ${MAX_MEDIA_FILES} datotek je dovoljenih`)
      return
    }

    setScheduledAtError(null)
    setMediaError(null)

    if (!user) {
      toast.error('Niste prijavljeni')
      return
    }

    const meta = createPostMetaState(parsed.data)

    try {
      if (isEditMode && initialData) {
        const isImmediatePublish =
          initialData.status === 'scheduled' && parsed.data.status === 'published'

        await updatePost({
          postId: initialData.id,
          formValues: parsed.data,
          mediaItems,
          originalMedia,
          meta,
          gallery: mediaItems,
          editor: editorValue,
        })

        if (isImmediatePublish) {
          const response = await fetch('/api/posts/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId: initialData.id }),
          })

          if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            throw new Error(data.error ?? 'Napaka pri objavi')
          }
        }

        toast.success(
          isImmediatePublish
            ? 'Objava je bila objavljena'
            : 'Objava je bila posodobljena'
        )
      } else {
        await createPost({
          formValues: parsed.data,
          mediaItems,
          authorId: user.id,
          meta,
          gallery: mediaItems,
          editor: editorValue,
        })
        toast.success('Objava je bila objavljena')
      }

      router.push('/feed')
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Napaka pri shranjevanju'
      toast.error(message)
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium">
          Naslov
        </label>
        <Input
          id="title"
          aria-label="Naslov"
          {...register('title', {
            required: 'Naslov je obvezen',
            maxLength: {
              value: 255,
              message: 'Naslov je predolg (max 255 znakov)',
            },
          })}
          disabled={isSubmitting}
          aria-invalid={Boolean(errors.title)}
        />
        {errors.title ? (
          <p className="text-xs text-destructive" role="alert">
            {errors.title.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="category" className="text-sm font-medium">
          Kategorija
        </label>
        <select
          id="category"
          aria-label="Kategorija"
          {...register('category', { required: 'Kategorija je obvezna' })}
          disabled={isSubmitting || isCategoriesLoading}
          aria-invalid={Boolean(errors.category)}
          className="min-h-[44px] w-full rounded-lg border border-border bg-muted/50 px-3 py-3 text-sm text-foreground transition-colors focus-visible:border-primary focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:pointer-events-none disabled:opacity-50"
        >
          <option value="">
            {isCategoriesLoading ? 'Nalaganje...' : 'Izberite kategorijo'}
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
        {errors.category ? (
          <p className="text-xs text-destructive" role="alert">
            {errors.category.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="excerpt" className="text-sm font-medium">
          Povzetek
        </label>
        <Input
          id="excerpt"
          aria-label="Povzetek"
          {...register('excerpt', {
            maxLength: {
              value: 500,
              message: 'Povzetek je predolg (max 500 znakov)',
            },
          })}
          disabled={isSubmitting}
          aria-invalid={Boolean(errors.excerpt)}
        />
        {errors.excerpt ? (
          <p className="text-xs text-destructive" role="alert">
            {errors.excerpt.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Galerija objave</span>
        <MediaUploader
          items={mediaItems}
          onChange={handleMediaChange}
          isSubmitting={isSubmitting}
        />
        {mediaError ? (
          <p
            className="text-xs text-destructive"
            role="alert"
            data-testid="media-required-error"
          >
            {mediaError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="content" className="text-sm font-medium">
          Vsebina objave
        </label>
        <input
          id="content"
          type="hidden"
          aria-label="Vsebina objave"
          {...register('content')}
        />
        <TiptapEditor
          value={editorValue}
          onChange={(nextValue) => {
            setEditorValue(nextValue)
            setValue('content', nextValue.html, { shouldDirty: true })
          }}
          onInlineImageUpload={uploadInlineImage}
          onUploadError={(message) => toast.error(message)}
          disabled={isSubmitting}
        />
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <span className="text-sm font-medium">Nastavitve objave</span>

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
            <span className="text-sm">
              Uvajanje novih članic (Top-{MAX_ONBOARDING_POSTS})
            </span>
            <span className="text-xs text-muted-foreground">
              Največ {MAX_ONBOARDING_POSTS} objav hkrati
            </span>
          </div>
        </label>

        <div
          className="flex overflow-hidden rounded-none border"
          role="group"
          aria-label="Način objave"
        >
          <button
            type="button"
            className={cn(
              'flex-1 min-h-[44px] min-w-[44px] px-4 rounded-none font-sans text-xs font-medium tracking-[0.2em] uppercase transition-colors',
              'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
              !isScheduledMode
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            )}
            aria-pressed={!isScheduledMode}
            onClick={() => handleModeChange('published')}
            disabled={isSubmitting}
          >
            Objavi zdaj
          </button>
          <button
            type="button"
            className={cn(
              'flex-1 min-h-[44px] min-w-[44px] border-l px-4 rounded-none font-sans text-xs font-medium tracking-[0.2em] uppercase transition-colors',
              'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
              isScheduledMode
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
              wasAlreadyPublished ? 'cursor-not-allowed opacity-50' : ''
            )}
            aria-pressed={isScheduledMode}
            onClick={() => handleModeChange('scheduled')}
            disabled={isSubmitting || wasAlreadyPublished}
          >
            Načrtuj objavo
          </button>
        </div>

        {isScheduledMode ? (
          <div className="flex flex-col gap-1.5">
            <input
              type="datetime-local"
              className={cn(
                'min-h-[44px] min-w-[44px] rounded-lg border px-3 py-2 text-sm',
                'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
                scheduledAtError ? 'border-destructive' : 'border-border'
              )}
              aria-label="Datum in čas objave"
              aria-describedby="schedule-preview"
              aria-invalid={Boolean(scheduledAtError)}
              min={getMinDatetime()}
              value={localDatetimeValue}
              onChange={(event) => handleDatetimeChange(event.target.value)}
              disabled={isSubmitting}
            />
            {scheduledAt && !scheduledAtError ? (
              <p
                id="schedule-preview"
                className="text-xs tracking-[0.1em] text-muted-foreground"
              >
                {formatSchedulePreview(scheduledAt)}
              </p>
            ) : null}
            {scheduledAtError ? (
              <p className="text-sm text-destructive" role="alert">
                {scheduledAtError}
              </p>
            ) : null}
          </div>
        ) : null}

        {isLandingPreview || isOnboarding ? (
          <p className="text-xs text-muted-foreground">
            {[
              isLandingPreview && 'predogled na začetni strani',
              isOnboarding && 'uvajanje novih članic',
            ]
              .filter(Boolean)
              .join(' in ')
              .replace(/^./, (value) => value.toUpperCase())}
          </p>
        ) : null}
      </section>

      <PostComposerPreview
        title={title ?? ''}
        excerpt={excerpt ?? ''}
        gallery={mediaItems}
        editor={editorValue}
        warning={compositionWarning}
      />

      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            <span>Shranjevanje...</span>
          </>
        ) : isEditMode && isScheduledMode ? (
          'Shrani spremembe'
        ) : isScheduledMode ? (
          'Načrtuj'
        ) : isEditMode ? (
          'Shrani'
        ) : (
          'Objavi'
        )}
      </Button>
    </form>
  )
}
