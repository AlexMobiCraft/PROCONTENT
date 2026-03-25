import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()
const mockRouterPush = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}))

import { useLikeToggle } from '@/hooks/useLikeToggle'
import type { Post } from '@/features/feed/types'

function makePost(id: string, overrides: Partial<Post> = {}): Post {
  return {
    id,
    author_id: 'author-1',
    title: `Post ${id}`,
    excerpt: 'excerpt',
    content: null,
    category: 'insight',
    type: 'text',
    image_url: null,
    likes_count: 5,
    comments_count: 2,
    is_published: true,
    is_landing_preview: false,
    is_onboarding: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    is_liked: false,
    posts_is_liked: false,
    profiles: { display_name: 'Author', avatar_url: null },
    post_media: [],
    ...overrides,
  }
}

describe('useLikeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('перенаправляет на /login при лайке без авторизации', async () => {
    const setPosts = vi.fn()
    const { result } = renderHook(() =>
      useLikeToggle({
        posts: [makePost('p1')],
        setPosts,
        currentUser: null,
      })
    )

    await act(async () => {
      await result.current.handleLikeToggle('p1')
    })

    expect(mockRouterPush).toHaveBeenCalledWith('/login')
    expect(setPosts).not.toHaveBeenCalled()
  })

  it('не вызывает setPosts для несуществующего поста', async () => {
    const setPosts = vi.fn()
    const { result } = renderHook(() =>
      useLikeToggle({
        posts: [makePost('p1')],
        setPosts,
        currentUser: { id: 'user-1' },
      })
    )

    await act(async () => {
      await result.current.handleLikeToggle('nonexistent')
    })

    expect(setPosts).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('выполняет оптимистичное обновление и синхронизирует с сервером', async () => {
    mockRpc.mockResolvedValue({
      data: { is_liked: true, likes_count: 6 },
      error: null,
    })
    const setPosts = vi.fn()
    const { result } = renderHook(() =>
      useLikeToggle({
        posts: [makePost('p1', { is_liked: false, likes_count: 5 })],
        setPosts,
        currentUser: { id: 'user-1' },
      })
    )

    await act(async () => {
      await result.current.handleLikeToggle('p1')
    })

    expect(mockRpc).toHaveBeenCalledWith('toggle_like', { p_post_id: 'p1' })
    expect(setPosts).toHaveBeenCalledTimes(2)
  })

  it('откатывает изменения при ошибке RPC', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: new Error('RPC error'),
    })
    const setPosts = vi.fn()
    const { result } = renderHook(() =>
      useLikeToggle({
        posts: [makePost('p1', { is_liked: false, likes_count: 5 })],
        setPosts,
        currentUser: { id: 'user-1' },
      })
    )

    await act(async () => {
      await result.current.handleLikeToggle('p1')
    })

    expect(setPosts).toHaveBeenCalledTimes(2)
    const rollbackCall = setPosts.mock.calls[1][0] as (prev: Post[]) => Post[]
    const rollbackResult = rollbackCall([makePost('p1', { is_liked: true, likes_count: 6 })])
    expect(rollbackResult[0].is_liked).toBe(false)
    expect(rollbackResult[0].likes_count).toBe(5)
  })

  it('возвращает pendingLikes с postId во время ожидания', async () => {
    let resolveFn!: () => void
    mockRpc.mockReturnValue(
      new Promise<{ data: { is_liked: boolean; likes_count: number }; error: null }>((resolve) => {
        resolveFn = () => resolve({ data: { is_liked: true, likes_count: 6 }, error: null })
      })
    )
    const setPosts = vi.fn()
    const { result } = renderHook(() =>
      useLikeToggle({
        posts: [makePost('p1')],
        setPosts,
        currentUser: { id: 'user-1' },
      })
    )

    act(() => {
      void result.current.handleLikeToggle('p1')
    })

    expect(result.current.pendingLikes).toContain('p1')

    await act(async () => {
      resolveFn()
    })

    expect(result.current.pendingLikes).not.toContain('p1')
  })
})
