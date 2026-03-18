'use client'

import { useEffect, useRef, useCallback } from 'react'
import { PostCard, PostCardSkeleton } from '@/components/feed/PostCard'
import { fetchPosts } from '../api/posts'
import { useFeedStore } from '../store'
import { dbPostToCardData } from '../types'

function Skeletons({ count }: { count: number }) {
  return Array.from({ length: count }).map((_, i) => (
    <PostCardSkeleton key={i} />
  ))
}

export function FeedContainer() {
  const {
    posts,
    hasMore,
    isLoading,
    isLoadingMore,
    activeCategory,
    setPosts,
    setLoading,
  } = useFeedStore()

  const observerRef = useRef<HTMLDivElement>(null)

  // Начальная загрузка + перезагрузка при смене категории
  useEffect(() => {
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
    // activeCategory — триггер перезагрузки при смене категории (changeCategory сбрасывает posts)
    // setLoading/setPosts — стабильные Zustand-экшены, в deps не нужны
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory])

  // Загрузка следующей страницы — читает живое состояние через getState() вместо замыканий.
  // Это устраняет проблему stale closure: loadMore стабилен (deps []),
  // поэтому IntersectionObserver не пересоздаётся при каждом изменении isLoadingMore.
  const loadMore = useCallback(async () => {
    const {
      hasMore,
      isLoadingMore,
      cursor,
      appendPosts,
      setLoadingMore,
    } = useFeedStore.getState()
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
  }, []) // Стабильная ссылка: состояние читается в момент вызова через getState()

  // IntersectionObserver для infinite scroll (AC #2).
  // Пересоздаётся только при изменении hasMore (конец ленты), не при isLoadingMore.
  useEffect(() => {
    if (!observerRef.current || !hasMore) return

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
  }, [hasMore, loadMore])

  // Клиентская фильтрация по категории (серверная — в Story 2.4)
  const displayedPosts =
    activeCategory === 'all'
      ? posts
      : posts.filter((p) => p.category === activeCategory)

  // Состояние начальной загрузки — скелетоны (AC #3)
  if (isLoading) {
    return (
      <div role="status" aria-label="Загрузка ленты">
        <Skeletons count={5} />
      </div>
    )
  }

  // Empty state (AC #5)
  if (displayedPosts.length === 0) {
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
        {displayedPosts.map((post) => (
          <li key={post.id}>
            <PostCard post={dbPostToCardData(post)} />
          </li>
        ))}
      </ul>

      {/* Скелетоны при подгрузке следующей страницы (AC #3) */}
      {isLoadingMore && (
        <div role="status" aria-label="Загрузка новых постов">
          <Skeletons count={3} />
        </div>
      )}

      {/* Trigger infinite scroll (AC #2) — sentinel в DOM только когда есть отображаемые посты.
          Без этой проверки при клиентской фильтрации по пустой категории sentinel
          остаётся видимым → loadMore зацикливается, пока hasMore не станет false. */}
      {hasMore && displayedPosts.length > 0 && (
        <div ref={observerRef} aria-hidden />
      )}

      {/* End of feed message (AC #4) */}
      {!hasMore && displayedPosts.length > 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Вы просмотрели все публикации
        </p>
      )}
    </div>
  )
}
