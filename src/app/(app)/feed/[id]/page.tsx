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

  return {
    title: post.title,
    description: post.excerpt || post.title,
    openGraph: {
      title: post.title,
      description: post.excerpt || post.title,
      images: post.imageUrl ? [post.imageUrl] : undefined,
    },
  }
}

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const [post, { data: { user } }] = await Promise.all([
    fetchPostById(id),
    supabase.auth.getUser(),
  ])

  if (!post) {
    notFound()
  }

  return <PostDetail post={post} currentUserId={user?.id ?? null} />
}
