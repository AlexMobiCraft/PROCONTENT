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
  /** ID постов, по которым выполняется запрос toggle_like (блокировка спама) */
  pendingLikes: string[]
  /** ID активного воспроизводимого видео. null = нет активного. NFR4.1 */
  activeVideoId: string | null
  /** Список категорий из БД */
  categories: { id: string; name: string; slug: string }[]
  isCategoriesLoading: boolean
  setActiveVideo: (id: string | null) => void
  setPosts: (posts: Post[], cursor: string | null, hasMore: boolean) => void
  appendPosts: (posts: Post[], cursor: string | null, hasMore: boolean) => void
  removePost: (postId: string) => void
  setActiveCategory: (category: string) => void
  setCategories: (categories: { id: string; name: string; slug: string }[]) => void
  setCategoriesLoading: (loading: boolean) => void
  setLoading: (loading: boolean) => void
  setLoadingMore: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
  changeCategory: (category: string) => void
  /** Точечное обновление полей конкретного поста по ID */
  updatePost: (postId: string, updates: Partial<Post>) => void
  addPendingLike: (postId: string) => void
  removePendingLike: (postId: string) => void
  /** Обновляет avatar_url профиля во всех кэшированных постах этого автора */
  updateProfileAvatar: (userId: string, avatarUrl: string | null) => void
}

const initialState = {
  posts: [] as Post[],
  cursor: null as string | null,
  hasMore: true,
  isLoading: true, // true по умолчанию — скелетоны до первой загрузки (устраняет flash empty state)
  isLoadingMore: false,
  error: null as string | null,
  activeCategory: 'all',
  pendingLikes: [] as string[],
  activeVideoId: null as string | null,
  categories: [] as { id: string; name: string; slug: string }[],
  isCategoriesLoading: true,
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

  removePost: (postId) =>
    set((state) => ({
      posts: state.posts.filter((post) => post.id !== postId),
    })),

  setActiveCategory: (category) =>
    set({ activeCategory: category }),

  setCategories: (categories) =>
    set({ categories, isCategoriesLoading: false }),

  setCategoriesLoading: (isCategoriesLoading) => set({ isCategoriesLoading }),

  setLoading: (isLoading) => set({ isLoading }),

  setLoadingMore: (isLoadingMore) => set({ isLoadingMore }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),

  // Смена категории: только обновляет activeCategory.
  // Данные ленты НЕ сбрасываются — клиентская фильтрация работает на кэшированных постах.
  // Это предотвращает разрушительную перезагрузку при переключении между категориями.
  changeCategory: (category) => set({ activeCategory: category, pendingLikes: [] }),

  // Обновление конкретного поста (для оптимистичных апдейтов и sync с RPC)
  updatePost: (postId, updates) =>
    set((state) => ({
      posts: state.posts.map((p) =>
        p.id === postId ? { ...p, ...updates } : p
      ),
    })),

  addPendingLike: (postId) =>
    set((state) => ({
      pendingLikes: state.pendingLikes.includes(postId)
        ? state.pendingLikes
        : [...state.pendingLikes, postId],
    })),

  removePendingLike: (postId) =>
    set((state) => ({
      pendingLikes: state.pendingLikes.filter((id) => id !== postId),
    })),

  setActiveVideo: (id) => set({ activeVideoId: id }),

  updateProfileAvatar: (userId, avatarUrl) =>
    set((state) => ({
      posts: state.posts.map((p) =>
        p.author_id === userId && p.profiles
          ? { ...p, profiles: { ...p.profiles, avatar_url: avatarUrl } }
          : p
      ),
    })),
}))

