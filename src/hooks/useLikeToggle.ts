'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Post, ToggleLikeResponse } from '@/features/feed/types'

interface UseLikeToggleOptions {
  posts: Post[]
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>
  currentUser: { id: string } | null
}

interface UseLikeToggleReturn {
  pendingLikes: string[]
  handleLikeToggle: (postId: string) => Promise<void>
}

/**
 * Переиспользуемый хук для оптимистичного переключения лайков.
 * Управляет состоянием pending, оптимистичным обновлением и rollback при ошибке.
 */
export function useLikeToggle({
  posts,
  setPosts,
  currentUser,
}: UseLikeToggleOptions): UseLikeToggleReturn {
  const router = useRouter()
  const [pendingLikes, setPendingLikes] = useState<string[]>([])

  const handleLikeToggle = useCallback(
    async (postId: string) => {
      if (!currentUser) {
        router.push('/login')
        return
      }
      if (pendingLikes.includes(postId)) return

      const post = posts.find((p) => p.id === postId)
      if (!post) return
      const prevIsLiked = post.is_liked ?? false
      const prevLikesCount = post.likes_count

      setPendingLikes((prev) => [...prev, postId])
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, is_liked: !prevIsLiked, likes_count: prevLikesCount + (prevIsLiked ? -1 : 1) }
            : p
        )
      )

      try {
        const supabase = createClient()
        const { data, error } = await supabase.rpc('toggle_like', { p_post_id: postId })
        if (error) throw error
        const result = data as unknown as ToggleLikeResponse
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, is_liked: result.is_liked, likes_count: result.likes_count }
              : p
          )
        )
      } catch (err) {
        console.error('Ошибка toggle_like:', err)
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, is_liked: prevIsLiked, likes_count: prevLikesCount }
              : p
          )
        )
      } finally {
        setPendingLikes((prev) => prev.filter((id) => id !== postId))
      }
    },
    [currentUser, router, posts, pendingLikes, setPosts]
  )

  return { pendingLikes, handleLikeToggle }
}
