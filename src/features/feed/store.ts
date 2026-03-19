'use client'

import { create } from 'zustand'
import type { Post } from './types'

interface FeedState {
  posts: Post[]
  cursor: string | null
  hasMore: boolean
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  activeCategory: string
  setPosts: (posts: Post[], cursor: string | null, hasMore: boolean) => void
  appendPosts: (posts: Post[], cursor: string | null, hasMore: boolean) => void
  setActiveCategory: (category: string) => void
  setLoading: (loading: boolean) => void
  setLoadingMore: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
  changeCategory: (category: string) => void
}

const initialState = {
  posts: [] as Post[],
  cursor: null as string | null,
  hasMore: true,
  isLoading: true, // true по умолчанию — скелетоны до первой загрузки (устраняет flash empty state)
  isLoadingMore: false,
  error: null as string | null,
  activeCategory: 'all',
}

export const useFeedStore = create<FeedState>((set) => ({
  ...initialState,

  setPosts: (posts, cursor, hasMore) =>
    set({ posts, cursor, hasMore, error: null }),

  appendPosts: (posts, cursor, hasMore) =>
    set((state) => {
      const existingIds = new Set(state.posts.map((p) => p.id))
      const uniqueNew = posts.filter((p) => !existingIds.has(p.id))
      return {
        posts: [...state.posts, ...uniqueNew],
        cursor,
        hasMore,
      }
    }),

  setActiveCategory: (category) =>
    set({ activeCategory: category }),

  setLoading: (isLoading) => set({ isLoading }),

  setLoadingMore: (isLoadingMore) => set({ isLoadingMore }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),

  // Смена категории: только обновляет activeCategory.
  // Данные ленты НЕ сбрасываются — клиентская фильтрация работает на кэшированных постах.
  // Это предотвращает разрушительную перезагрузку при переключении между категориями.
  changeCategory: (category) => set({ activeCategory: category }),
}))
