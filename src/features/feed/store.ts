'use client'

import { create } from 'zustand'
import type { Post } from './types'

interface FeedState {
  posts: Post[]
  cursor: string | null
  hasMore: boolean
  isLoading: boolean
  isLoadingMore: boolean
  activeCategory: string
  setPosts: (posts: Post[], cursor: string | null, hasMore: boolean) => void
  appendPosts: (posts: Post[], cursor: string | null, hasMore: boolean) => void
  setActiveCategory: (category: string) => void
  setLoading: (loading: boolean) => void
  setLoadingMore: (loading: boolean) => void
  reset: () => void
  changeCategory: (category: string) => void
}

const initialState = {
  posts: [] as Post[],
  cursor: null as string | null,
  hasMore: true,
  isLoading: false,
  isLoadingMore: false,
  activeCategory: 'all',
}

export const useFeedStore = create<FeedState>((set) => ({
  ...initialState,

  setPosts: (posts, cursor, hasMore) =>
    set({ posts, cursor, hasMore }),

  appendPosts: (posts, cursor, hasMore) =>
    set((state) => ({
      posts: [...state.posts, ...posts],
      cursor,
      hasMore,
    })),

  setActiveCategory: (category) =>
    set({ activeCategory: category }),

  setLoading: (isLoading) => set({ isLoading }),

  setLoadingMore: (isLoadingMore) => set({ isLoadingMore }),

  reset: () => set(initialState),

  // Атомарная смена категории: сброс данных + установка новой категории за одну операцию
  changeCategory: (category) =>
    set({ ...initialState, activeCategory: category }),
}))
