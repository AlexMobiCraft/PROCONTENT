import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchPostById } from '@/features/feed/api/serverPosts'
import { fetchPostComments } from '@/features/comments/api/comments'
import { createClient } from '@/lib/supabase/server'
import { PostDetail } from '@/components/feed/PostDetail'

export const dynamic = 'force-dynamic'

interface PostPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
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

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  return {
    title: post.title,
    description: post.excerpt || post.title,
    openGraph: {
      title: post.title,
      description: post.excerpt || post.title,
      url: `${baseUrl}/feed/${id}`,
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

export default async function PostPage({ params, searchParams }: PostPageProps) {
  const { id } = await params
  const { from } = await searchParams
  const supabase = await createClient()
  const [post, authResult] = await Promise.all([
    fetchPostById(id),
    supabase.auth.getUser().catch(() => ({ data: { user: null } })),
  ])
  const user = authResult.data.user

  if (!post) {
    notFound()
  }

  // Загружаем комментарии и профиль текущего пользователя параллельно
  const [comments, profileResult] = await Promise.all([
    fetchPostComments(id).catch(() => []),
    user
      ? supabase
          .from('profiles')
          .select('id, display_name, avatar_url, role')
          .eq('id', user.id)
          .single()
      : Promise.resolve({ data: null }),
  ])
  const currentUserProfile = (profileResult as { data: { id: string; display_name: string | null; avatar_url: string | null; role: string | null } | null })?.data ?? null

  // Форматируем дату в RSC — исключает useState+useEffect и layout shift на клиенте (Fix #3)
  const formattedDate = new Date(post.created_at).toLocaleDateString('sl-SI', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <PostDetail
      post={post}
      currentUserId={user?.id ?? null}
      currentUserProfile={currentUserProfile}
      from={from}
      formattedDate={formattedDate}
      initialComments={comments}
    />
  )
}
