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
  } = useFeedStore()

  const observerRef = useRef<HTMLDivElement>(null)

  // Начальная загрузка + перезагрузка при смене категории.
  // Состояние читается через getState() в момент вызова — нет stale closure, не нужен eslint-disable.
  useEffect(() => {
    // Если уже есть данные в store — восстанавливаем из кэша (AC #6)
    if (useFeedStore.getState().posts.length > 0) return

    async function loadInitial() {
      useFeedStore.getState().setLoading(true)
      try {
        const { posts: newPosts, nextCursor, hasMore } = await fetchPosts()
        useFeedStore.getState().setPosts(newPosts, nextCursor, hasMore)
      } catch (err) {
        console.error('Ошибка загрузки ленты:', err)
      } finally {
        useFeedStore.getState().setLoading(false)
      }
    }

    loadInitial()
  }, [activeCategory])

  // Загрузка следующей страницы — читает живое состояние через getState().
  // Стабильная ссылка (deps []) → IntersectionObserver не пересоздаётся при каждом isLoadingMore.
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
      // При ошибке сбрасываем hasMore=false — прекращаем запросы, скрываем sentinel.
      // Без этого IntersectionObserver зациклится: sentinel виден → loadMore → ошибка → повтор.
      appendPosts([], null, false)
    } finally {
      setLoadingMore(false)
    }
  }, [])

  // IntersectionObserver для infinite scroll (AC #2).
  // Пересоздаётся только при изменении hasMore.
  useEffect(() => {
    if (!observerRef.current || !hasMore) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(observerRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  // Клиентская фильтрация по категории (серверная — в Story 2.4)
  const displayedPosts =
    activeCategory === 'all'
      ? posts
      : posts.filter((p) => p.category === activeCategory)

  // Когда клиентский фильтр даёт 0 постов, но в БД есть ещё страницы — автоматически подгружаем.
  // Без этого при пустом displayedPosts компонент уходит в early-return (empty state или skeletons),
  // sentinel не попадает в DOM, IntersectionObserver не срабатывает — пагинация останавливается.
  useEffect(() => {
    if (
      displayedPosts.length === 0 &&
      hasMore &&
      !isLoading &&
      !isLoadingMore &&
      posts.length > 0
    ) {
      loadMore()
    }
  }, [displayedPosts.length, hasMore, isLoading, isLoadingMore, posts.length, loadMore])

  // Состояние начальной загрузки — скелетоны (AC #3)
  if (isLoading) {
    return (
      <div role="status" aria-label="Загрузка ленты">
        <Skeletons count={5} />
      </div>
    )
  }

  // Нет отображаемых постов для текущей категории
  if (displayedPosts.length === 0) {
    // Ещё подгружаем страницы в поисках постов данной категории — скелетоны вместо пустого экрана
    if (isLoadingMore) {
      return (
        <div role="status" aria-label="Загрузка ленты">
          <Skeletons count={5} />
        </div>
      )
    }
    // hasMore=false: постов с такой категорией нет → empty state (AC #5)
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

      {/* Trigger infinite scroll (AC #2) — sentinel в DOM пока есть ещё данные */}
      {hasMore && <div ref={observerRef} aria-hidden />}

      {/* End of feed message (AC #4) */}
      {!hasMore && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Вы просмотрели все публикации
        </p>
      )}
    </div>
  )
}
