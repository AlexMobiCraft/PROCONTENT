import { describe, expect, it, beforeEach } from 'vitest'
import { useFeedStore } from '@/features/feed/store'
import type { Post } from '@/features/feed/types'

function makePost(id: string, category = 'insight'): Post {
  return {
    id,
    author_id: 'user-1',
    title: `Пост ${id}`,
    excerpt: null,
    content: null,
    category,
    type: 'text',
    image_url: null,
    likes_count: 0,
    comments_count: 0,
    is_published: true,
    is_landing_preview: false,
    is_onboarding: false,
    created_at: '2026-03-15T10:00:00Z',
    updated_at: '2026-03-15T10:00:00Z',
    profiles: { display_name: 'Автор', avatar_url: null },
  }
}

describe('useFeedStore', () => {
  beforeEach(() => {
    useFeedStore.getState().reset()
  })

  it('initialState: isLoading true, posts пустые, activeCategory "all"', () => {
    const state = useFeedStore.getState()

    expect(state.isLoading).toBe(true)
    expect(state.posts).toEqual([])
    expect(state.hasMore).toBe(true)
    expect(state.isLoadingMore).toBe(false)
    expect(state.activeCategory).toBe('all')
    expect(state.cursor).toBeNull()
  })

  it('setPosts заменяет посты, курсор и hasMore', () => {
    const posts = [makePost('1'), makePost('2')]
    useFeedStore.getState().setPosts(posts, 'cursor-1', true)

    const state = useFeedStore.getState()
    expect(state.posts).toHaveLength(2)
    expect(state.cursor).toBe('cursor-1')
    expect(state.hasMore).toBe(true)
  })

  it('appendPosts добавляет к существующим постам', () => {
    useFeedStore.getState().setPosts([makePost('1')], 'c1', true)
    useFeedStore.getState().appendPosts([makePost('2')], 'c2', false)

    const state = useFeedStore.getState()
    expect(state.posts).toHaveLength(2)
    expect(state.posts[0].id).toBe('1')
    expect(state.posts[1].id).toBe('2')
    expect(state.cursor).toBe('c2')
    expect(state.hasMore).toBe(false)
  })

  it('setActiveCategory обновляет категорию', () => {
    useFeedStore.getState().setActiveCategory('reels')
    expect(useFeedStore.getState().activeCategory).toBe('reels')
  })

  it('setLoading обновляет isLoading', () => {
    useFeedStore.getState().setLoading(false)
    expect(useFeedStore.getState().isLoading).toBe(false)
  })

  it('setLoadingMore обновляет isLoadingMore', () => {
    useFeedStore.getState().setLoadingMore(true)
    expect(useFeedStore.getState().isLoadingMore).toBe(true)
  })

  it('reset возвращает к initialState', () => {
    useFeedStore.getState().setPosts([makePost('1')], 'c1', false)
    useFeedStore.getState().setActiveCategory('reels')
    useFeedStore.getState().setLoading(false)

    useFeedStore.getState().reset()
    const state = useFeedStore.getState()

    expect(state.posts).toEqual([])
    expect(state.cursor).toBeNull()
    expect(state.hasMore).toBe(true)
    expect(state.isLoading).toBe(true)
    expect(state.activeCategory).toBe('all')
  })

  it('changeCategory атомарно сбрасывает данные и устанавливает категорию', () => {
    useFeedStore.getState().setPosts([makePost('1')], 'c1', false)
    useFeedStore.getState().setLoading(false)

    useFeedStore.getState().changeCategory('razobory')
    const state = useFeedStore.getState()

    expect(state.activeCategory).toBe('razobory')
    expect(state.posts).toEqual([])
    expect(state.cursor).toBeNull()
    expect(state.hasMore).toBe(true)
    expect(state.isLoading).toBe(true) // сброс к initialState
  })

  it('changeCategory на "all" тоже сбрасывает', () => {
    useFeedStore.getState().setPosts([makePost('1')], 'c1', false)
    useFeedStore.getState().setActiveCategory('reels')

    useFeedStore.getState().changeCategory('all')
    expect(useFeedStore.getState().activeCategory).toBe('all')
    expect(useFeedStore.getState().posts).toEqual([])
  })
})
