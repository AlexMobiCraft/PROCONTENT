import { act, render } from '@testing-library/react'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useFeedStore } from '@/features/feed/store'
import type { Post } from '@/features/feed/types'

vi.mock('@/components/feed/CategoryScroll', () => ({
  CategoryScroll: () => <div data-testid="category-scroll" />,
}))

vi.mock('@/features/feed/components/FeedContainer', () => ({
  FeedContainer: () => <div data-testid="feed-container" />,
}))

import { FeedPageClient } from '@/features/feed/components/FeedPageClient'

function makePost(id: string): Post {
  return {
    id,
    author_id: 'user-1',
    title: `Post ${id}`,
    excerpt: 'excerpt',
    content: null,
    category: 'insight',
    type: 'text',
    image_url: null,
    likes_count: 0,
    comments_count: 0,
    is_published: true,
    is_landing_preview: false,
    is_onboarding: false,
    created_at: '2026-03-20T10:00:00Z',
    updated_at: '2026-03-20T10:00:00Z',
    profiles: { display_name: 'Author', avatar_url: null },
  }
}

describe('FeedPageClient / FeedStoreInitializer', () => {
  beforeEach(() => {
    useFeedStore.getState().reset()
  })

  it('гидратирует store с initialData до рендера FeedContainer (LCP fix)', () => {
    const posts = [makePost('1'), makePost('2')]

    render(<FeedPageClient initialData={{ posts, nextCursor: 'cursor', hasMore: true }} />)

    const state = useFeedStore.getState()
    expect(state.posts).toEqual(posts)
    expect(state.hasMore).toBe(true)
    expect(state.isLoading).toBe(false)
  })

  it('не перезаписывает store при повторном рендере если посты уже загружены (кэш навигации)', () => {
    const initialPosts = [makePost('1')]

    render(<FeedPageClient initialData={{ posts: initialPosts, nextCursor: null, hasMore: false }} />)

    // Пользователь прокрутил ленту — в store добавились новые посты
    act(() => {
      useFeedStore.getState().setPosts([makePost('1'), makePost('2')], null, false)
    })

    // Повторный рендер (другой экземпляр) — store не должен перегидратироваться
    render(<FeedPageClient initialData={{ posts: initialPosts, nextCursor: null, hasMore: false }} />)

    // store содержит 2 поста (добавленные после hydration), а не 1 из initialData
    expect(useFeedStore.getState().posts).toHaveLength(2)
  })

  it('пропускает гидрацию если сервер вернул пустой список (fallback к CSR)', () => {
    render(<FeedPageClient initialData={{ posts: [], nextCursor: null, hasMore: true }} />)

    // isLoading остаётся true — FeedContainer запустит клиентскую загрузку
    expect(useFeedStore.getState().isLoading).toBe(true)
    expect(useFeedStore.getState().posts).toHaveLength(0)
  })
})
