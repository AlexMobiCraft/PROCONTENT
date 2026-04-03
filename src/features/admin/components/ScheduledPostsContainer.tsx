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
  const [actingIds, setActingIds] = useState<string[]>([])

  async function handleCancel(id: string) {
    const snapshot = posts
    setActingIds((prev) => [...prev, id])
    setPosts((prev) => prev.filter((p) => p.id !== id))

    try {
      await cancelScheduledPost(id)
    } catch (err) {
      setPosts(snapshot)
      const message = err instanceof Error ? err.message : 'Prišlo je do napake pri preklicu'
      toast.error(message)
    } finally {
      setActingIds((prev) => prev.filter((actingId) => actingId !== id))
    }
  }

  async function handlePublishNow(id: string) {
    const snapshot = posts
    setActingIds((prev) => [...prev, id])
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
      setActingIds((prev) => prev.filter((actingId) => actingId !== id))
    }
  }

  function handleEdit(id: string) {
    router.push(getAdminPostEditPath(id))
  }

  return (
    <ScheduledPostsTable
      posts={posts}
      isLoading={false}
      actingIds={actingIds}
      onCancel={handleCancel}
      onEdit={handleEdit}
      onPublishNow={handlePublishNow}
    />
  )
}
