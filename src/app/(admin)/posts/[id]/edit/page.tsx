import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { PostForm } from '@/features/admin/components/PostForm'

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
        post_media: postMedia,
      }}
    />
  )
}

function EditPostSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-label="Nalaganje...">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-[44px] w-full animate-pulse rounded border bg-muted" />
        </div>
      ))}
      <div className="h-[44px] w-32 animate-pulse rounded bg-muted" />
    </div>
  )
}

export default async function EditPostPage({ params }: EditPostPageProps) {
  const { id } = await params

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 font-heading text-2xl font-semibold">Uredi objavo</h1>
      <Suspense fallback={<EditPostSkeleton />}>
        <EditPostContent postId={id} />
      </Suspense>
    </main>
  )
}
