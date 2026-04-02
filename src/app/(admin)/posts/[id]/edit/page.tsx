import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { PostForm } from '@/features/admin/components/PostForm'
import { EditPostSkeleton } from '@/features/admin/components/EditPostSkeleton'

interface EditPostPageProps {
  params: Promise<{ id: string }>
}

async function EditPostContent({ postId }: { postId: string }) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('posts')
    .select(
      `
      id,
      title,
      content,
      excerpt,
      category,
      type,
      status,
      scheduled_at,
      published_at,
      is_landing_preview,
      is_onboarding,
      post_media (
        id,
        url,
        thumbnail_url,
        media_type,
        order_index,
        is_cover
      )
    `
    )
    .eq('id', postId)
    .single()

  if (error || !data) {
    notFound()
  }

  // Normalize media_type to union — Supabase types return string for CHECK columns
  const postMedia = (data.post_media ?? []).map((m) => ({
    ...m,
    media_type: m.media_type as 'image' | 'video',
  }))

  return (
    <PostForm
      mode="edit"
      initialData={{
        id: data.id,
        title: data.title,
        content: data.content,
        excerpt: data.excerpt,
        category: data.category,
        type: data.type,
        status: data.status as 'draft' | 'scheduled' | 'published' | undefined,
        scheduled_at: data.scheduled_at,
        published_at: data.published_at,
        is_landing_preview: data.is_landing_preview,
        is_onboarding: data.is_onboarding,
        post_media: postMedia,
      }}
    />
  )
}

export default async function EditPostPage({ params }: EditPostPageProps) {
  const { id } = await params

  return (
    <main className="px-4 py-8">
      <h1 className="mb-6 font-heading text-2xl font-semibold">Uredi objavo</h1>
      <Suspense fallback={<EditPostSkeleton />}>
        <EditPostContent postId={id} />
      </Suspense>
    </main>
  )
}
