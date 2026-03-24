import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchPostById } from '@/features/feed/api/serverPosts'
import { createClient } from '@/lib/supabase/server'
import { PostDetail } from '@/components/feed/PostDetail'

interface PostPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { id } = await params
  const post = await fetchPostById(id)

  if (!post) {
    return { title: 'Objava ni najdena' }
  }

  // AC 7: OG image — для видео никогда не использовать .mp4 URL (невалидно для соцсетей)
  const ogImage = (() => {
    const isVideo = post.type === 'video' || post.mediaItem?.media_type === 'video'
    if (isVideo) return post.mediaItem?.thumbnail_url ?? undefined
    const url = post.imageUrl ?? undefined
    // Guard: старые записи могут иметь mp4 в imageUrl
    if (url?.toLowerCase().endsWith('.mp4')) return undefined
    return url
  })()

  return {
    title: post.title,
    description: post.excerpt || post.title,
    openGraph: {
      title: post.title,
      description: post.excerpt || post.title,
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/feed/${id}`,
      images: ogImage ? [ogImage] : undefined,
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: post.title,
      description: post.excerpt || post.title,
      images: ogImage ? [ogImage] : undefined,
    },
  }
}

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const [post, authResult] = await Promise.all([
    fetchPostById(id),
    supabase.auth.getUser().catch(() => ({ data: { user: null } })),
  ])
  const user = authResult.data.user

  if (!post) {
    notFound()
  }

  return <PostDetail post={post} currentUserId={user?.id ?? null} />
}
