import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Comment, CommentWithStatus } from '@/features/comments/types'

vi.mock('@/features/comments/api/clientComments', () => ({
  insertPostComment: vi.fn(),
}))

function makeComment(id: string, parentId: string | null = null): Comment {
  return {
    id,
    post_id: 'p-1',
    user_id: 'u-1',
    parent_id: parentId,
    content: `Komentar ${id}`,
    created_at: '2026-03-26T10:00:00Z',
    updated_at: '2026-03-26T10:00:00Z',
    profiles: { id: 'u-1', display_name: 'Ana', avatar_url: null, role: 'member' },
    replies: [],
  }
}

describe('useComments', () => {
  let mockInsert: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/features/comments/api/clientComments')
    mockInsert = mod.insertPostComment as ReturnType<typeof vi.fn>
  })

  it('инициализируется с initialComments', async () => {
    const { useComments } = await import('@/features/comments/hooks/useComments')
    const { result } = renderHook(() =>
      useComments({ postId: 'p-1', initialComments: [makeComment('c1')] })
    )
    expect(result.current.comments).toHaveLength(1)
    expect(result.current.comments[0].id).toBe('c1')
  })

  it('инициализируется с пустым массивом если initialComments не передан', async () => {
    const { useComments } = await import('@/features/comments/hooks/useComments')
    const { result } = renderHook(() =>
      useComments({ postId: 'p-1', initialComments: [] })
    )
    expect(result.current.comments).toHaveLength(0)
  })

  it('addComment: оптимистично добавляет комментарий со статусом pending', async () => {
    mockInsert.mockImplementation(() => new Promise(() => {})) // зависает
    const { useComments } = await import('@/features/comments/hooks/useComments')
    const { result } = renderHook(() =>
      useComments({ postId: 'p-1', initialComments: [] })
    )

    act(() => {
      result.current.addComment('Novi komentar')
    })

    expect(result.current.comments).toHaveLength(1)
    expect(result.current.comments[0].content).toBe('Novi komentar')
    expect(result.current.comments[0]._status).toBe('pending')
    expect(result.current.comments[0].id).toMatch(/^temp-/)
  })

  it('addComment: temp-id заменяется реальным после успеха', async () => {
    const saved = makeComment('real-id')
    mockInsert.mockResolvedValue(saved)
    const { useComments } = await import('@/features/comments/hooks/useComments')
    const { result } = renderHook(() =>
      useComments({ postId: 'p-1', initialComments: [] })
    )

    await act(async () => {
      await result.current.addComment('Novi komentar')
    })

    expect(result.current.comments).toHaveLength(1)
    expect(result.current.comments[0].id).toBe('real-id')
    expect(result.current.comments[0]._status).toBeUndefined()
  })

  it('addComment: при ошибке помечает статус error, содержимое не теряется', async () => {
    mockInsert.mockRejectedValue(new Error('Network error'))
    const { useComments } = await import('@/features/comments/hooks/useComments')
    const { result } = renderHook(() =>
      useComments({ postId: 'p-1', initialComments: [] })
    )

    await act(async () => {
      await result.current.addComment('Novi komentar')
    })

    expect(result.current.comments[0]._status).toBe('error')
    expect(result.current.comments[0].content).toBe('Novi komentar')
  })

  it('addComment с parentId: ответ добавляется к replies родительского комментария', async () => {
    mockInsert.mockImplementation(() => new Promise(() => {}))
    const { useComments } = await import('@/features/comments/hooks/useComments')
    const { result } = renderHook(() =>
      useComments({ postId: 'p-1', initialComments: [makeComment('root-1')] })
    )

    act(() => {
      result.current.addComment('Odgovor', 'root-1')
    })

    expect(result.current.comments[0].replies).toHaveLength(1)
    expect(result.current.comments[0].replies[0].content).toBe('Odgovor')
    expect(result.current.comments[0].replies[0]._status).toBe('pending')
  })

  it('addComment с parentId = reply.id: ответ флаттенится к корневому комментарию', async () => {
    mockInsert.mockImplementation(() => new Promise(() => {}))
    const root = makeComment('root-1')
    const reply: CommentWithStatus = { ...makeComment('reply-1', 'root-1') }
    const rootWithReply = { ...root, replies: [reply] }
    const { useComments } = await import('@/features/comments/hooks/useComments')
    const { result } = renderHook(() =>
      useComments({ postId: 'p-1', initialComments: [rootWithReply] })
    )

    act(() => {
      result.current.addComment('Nested reply', 'reply-1')
    })

    // Должен попасть к корневому комментарию
    expect(result.current.comments[0].replies).toHaveLength(2)
  })

  it('addComment: вызывает insertPostComment с корректными параметрами', async () => {
    const saved = makeComment('c2')
    mockInsert.mockResolvedValue(saved)
    const { useComments } = await import('@/features/comments/hooks/useComments')
    const { result } = renderHook(() =>
      useComments({ postId: 'my-post', initialComments: [] })
    )

    await act(async () => {
      await result.current.addComment('Hello', 'parent-1')
    })

    expect(mockInsert).toHaveBeenCalledWith({
      post_id: 'my-post',
      content: 'Hello',
      parent_id: 'parent-1',
    })
  })

  it('retryComment: меняет статус на pending, при успехе заменяет temp реальным', async () => {
    mockInsert.mockRejectedValueOnce(new Error('fail'))
    const { useComments } = await import('@/features/comments/hooks/useComments')
    const { result } = renderHook(() =>
      useComments({ postId: 'p-1', initialComments: [] })
    )

    await act(async () => {
      await result.current.addComment('Retry test')
    })
    expect(result.current.comments[0]._status).toBe('error')

    const failedComment = result.current.comments[0]
    const saved = makeComment('real-retry-id')
    mockInsert.mockResolvedValue(saved)

    await act(async () => {
      await result.current.retryComment(failedComment)
    })

    expect(result.current.comments[0].id).toBe('real-retry-id')
    expect(result.current.comments[0]._status).toBeUndefined()
  })

  it('retryComment: при повторной ошибке оставляет статус error', async () => {
    mockInsert.mockRejectedValue(new Error('fail'))
    const { useComments } = await import('@/features/comments/hooks/useComments')
    const { result } = renderHook(() =>
      useComments({ postId: 'p-1', initialComments: [] })
    )

    await act(async () => {
      await result.current.addComment('Retry test')
    })
    const failedComment = result.current.comments[0]

    await act(async () => {
      await result.current.retryComment(failedComment)
    })

    expect(result.current.comments[0]._status).toBe('error')
  })
})
