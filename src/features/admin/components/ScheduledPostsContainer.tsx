'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cancelScheduledPost } from '../api/posts'
import type { ScheduledPost } from '../types'
import { ScheduledPostsTable } from './ScheduledPostsTable'
import { getAdminPostEditPath } from '@/lib/app-routes'

interface ScheduledPostsContainerProps {
  initialPosts: ScheduledPost[]
}

export function ScheduledPostsContainer({ initialPosts }: ScheduledPostsContainerProps) {
  const router = useRouter()
  const [posts, setPosts] = useState<ScheduledPost[]>(initialPosts)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)

  async function handleCancel(id: string) {
    const snapshot = posts
    setActionInProgress(id)
    setPosts((prev) => prev.filter((p) => p.id !== id))

    try {
      await cancelScheduledPost(id)
    } catch (err) {
      setPosts(snapshot)
      const message = err instanceof Error ? err.message : 'Prišlo je do napake pri preklicu'
      toast.error(message)
    } finally {
      setActionInProgress(null)
    }
  }

  async function handlePublishNow(id: string) {
    const snapshot = posts
    setActionInProgress(id)
    setPosts((prev) => prev.filter((p) => p.id !== id))

    try {
      const res = await fetch('/api/posts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: id }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `Napaka pri objavi (${res.status})`)
      }
    } catch (err) {
      setPosts(snapshot)
      const message = err instanceof Error ? err.message : 'Prišlo je do napake pri objavi'
      toast.error(message)
    } finally {
      setActionInProgress(null)
    }
  }

  function handleEdit(id: string) {
    router.push(getAdminPostEditPath(id))
  }

  return (
    <ScheduledPostsTable
      posts={posts}
      isLoading={false}
      actionInProgress={actionInProgress}
      onCancel={handleCancel}
      onEdit={handleEdit}
      onPublishNow={handlePublishNow}
    />
  )
}
