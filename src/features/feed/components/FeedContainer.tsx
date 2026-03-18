'use client'

import { useEffect, useRef, useCallback } from 'react'
import { PostCard, PostCardSkeleton } from '@/components/feed/PostCard'
import { fetchPosts } from '../api/posts'
import { useFeedStore } from '../store'
import { dbPostToCardData } from '../types'

export function FeedContainer() {
  const {
    posts,
    cursor,
    hasMore,
    isLoading,
    isLoadingMore,
    setPosts,
    appendPosts,
    setLoading,
    setLoadingMore,
  } = useFeedStore()

  const observerRef = useRef<HTMLDivElement>(null)
  const initialLoadDone = useRef(false)

  // Начальная загрузка
  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true

    // Если уже есть данные в store — восстанавливаем из кэша (AC #6)
    if (posts.length > 0) return

    async function loadInitial() {
      setLoading(true)
      try {
        const { posts: newPosts, nextCursor, hasMore } = await fetchPosts()
        setPosts(newPosts, nextCursor, hasMore)
      } catch (err) {
        console.error('Ошибка загрузки ленты:', err)
      } finally {
        setLoading(false)
      }
    }

    loadInitial()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Загрузка следующей страницы
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || !cursor) return

    setLoadingMore(true)
    try {
      const {
        posts: newPosts,
        nextCursor,
        hasMore: more,
      } = await fetchPosts(cursor)
      appendPosts(newPosts, nextCursor, more)
    } catch (err) {
      console.error('Ошибка подгрузки постов:', err)
    } finally {
      setLoadingMore(false)
    }
  }, [hasMore, isLoadingMore, cursor, appendPosts, setLoadingMore])

  // IntersectionObserver для infinite scroll (AC #2)
  useEffect(() => {
    if (!observerRef.current || !hasMore || isLoadingMore) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: '200px' } // Начинать подгрузку заранее
    )

    observer.observe(observerRef.current)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, loadMore])

  // Состояние загрузки — скелетоны (AC #3)
  if (isLoading) {
    return (
      <div role="status" aria-label="Загрузка ленты">
        {Array.from({ length: 5 }).map((_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  // Empty state (AC #5)
  if (!isLoading && posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <p className="font-heading text-xl font-semibold text-foreground">
          Скоро здесь появится контент
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Следите за обновлениями клуба
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Список постов (AC #1) */}
      <ul aria-label="Лента публикаций">
        {posts.map((post) => (
          <li key={post.id}>
            <PostCard post={dbPostToCardData(post)} />
          </li>
        ))}
      </ul>

      {/* Скелетоны при подгрузке (AC #3) */}
      {isLoadingMore && (
        <div role="status" aria-label="Загрузка новых постов">
          {Array.from({ length: 3 }).map((_, i) => (
            <PostCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Trigger infinite scroll (AC #2) */}
      {hasMore && !isLoadingMore && <div ref={observerRef} aria-hidden />}

      {/* End of feed message (AC #4) */}
      {!hasMore && posts.length > 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Вы просмотрели все публикации
        </p>
      )}
    </div>
  )
}
