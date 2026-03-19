'use client'

import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import { useAuthStore } from '@/features/auth/store'
import { PostCard, PostCardSkeleton } from '@/components/feed/PostCard'
import { fetchPosts } from '../api/posts'
import { useFeedStore } from '../store'
import { dbPostToCardData } from '../types'

function Skeletons({
  count,
  context,
  showMedia = false,
}: {
  count: number
  context: string
  showMedia?: boolean
}) {
  return Array.from({ length: count }).map((_, i) => (
    <PostCardSkeleton key={`${context}-${i}`} showMedia={showMedia} />
  ))
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: string }).name === 'AbortError'
  )
    return true
  return false
}

export function FeedContainer() {
  // Индивидуальные селекторы — компонент перерисовывается только при изменении
  // нужных полей, а не при любом изменении store (например, cursor после appendPosts)
  const posts = useFeedStore((s) => s.posts)
  const hasMore = useFeedStore((s) => s.hasMore)
  const isLoading = useFeedStore((s) => s.isLoading)
  const isLoadingMore = useFeedStore((s) => s.isLoadingMore)
  const error = useFeedStore((s) => s.error)
  const activeCategory = useFeedStore((s) => s.activeCategory)
  const isAuthReady = useAuthStore((state) => state.isReady)
  const currentUserId = useAuthStore((state) => state.user?.id ?? null)

  const observerRef = useRef<HTMLDivElement>(null)
  const initialLoadAbortRef = useRef<AbortController | null>(null)
  const loadMoreAbortRef = useRef<AbortController | null>(null)

  // Отслеживает стагнацию: loadMore загрузил страницу, но ни один пост
  // не прошёл клиентский фильтр. Скрывает sentinel, показывает ручной CTA.
  const [isScrollStalled, setIsScrollStalled] = useState(false)

  const loadInitial = useCallback(async () => {
    initialLoadAbortRef.current?.abort()
    const controller = new AbortController()
    initialLoadAbortRef.current = controller

    useFeedStore.getState().setLoading(true)
    useFeedStore.getState().setError(null)
    try {
      const { posts: newPosts, nextCursor, hasMore } = await fetchPosts(undefined, {
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      useFeedStore.getState().setPosts(newPosts, nextCursor, hasMore)
    } catch (err) {
      if (isAbortError(err)) return
      console.error('Ошибка загрузки ленты:', err)
      useFeedStore.getState().setError('Не удалось загрузить ленту. Попробуйте снова.')
    } finally {
      if (initialLoadAbortRef.current === controller) {
        initialLoadAbortRef.current = null
        useFeedStore.getState().setLoading(false)
      }
    }
  }, [])

  // Начальная загрузка + перезагрузка при смене категории.
  // Состояние читается через getState() в момент вызова — нет stale closure.
  useEffect(() => {
    // Если уже есть данные в store — восстанавливаем из кэша (AC #6)
    if (useFeedStore.getState().posts.length === 0) {
      void loadInitial()
    }

    // Cleanup всегда регистрируется — при смене категории отменяем запросы
    // и сбрасываем isLoadingMore, чтобы он не завис после abort
    return () => {
      initialLoadAbortRef.current?.abort()
      initialLoadAbortRef.current = null
      loadMoreAbortRef.current?.abort()
      loadMoreAbortRef.current = null
      useFeedStore.getState().setLoadingMore(false)
    }
  }, [activeCategory, loadInitial])

  // Сбрасываем stall при смене категории
  useEffect(() => {
    setIsScrollStalled(false)
  }, [activeCategory])

  // Загрузка следующей страницы — читает живое состояние через getState().
  // Стабильная ссылка (deps []) → не пересоздаётся при каждом isLoadingMore.
  const loadMore = useCallback(async () => {
    const {
      hasMore,
      isLoadingMore,
      cursor,
      activeCategory: categoryBefore,
      appendPosts,
      setLoadingMore,
      setError,
    } = useFeedStore.getState()
    if (!hasMore || isLoadingMore || !cursor) return

    loadMoreAbortRef.current?.abort()
    const controller = new AbortController()
    loadMoreAbortRef.current = controller

    setLoadingMore(true)
    setError(null)
    try {
      const {
        posts: newPosts,
        nextCursor,
        hasMore: more,
      } = await fetchPosts(cursor, { signal: controller.signal })
      // Guard: если запрос отменён или категория сменилась — не добавлять stale данные
      if (controller.signal.aborted) return
      if (useFeedStore.getState().activeCategory !== categoryBefore) return
      appendPosts(newPosts, nextCursor, more)
    } catch (err) {
      if (isAbortError(err)) return
      console.error('Ошибка подгрузки постов:', err)
      setError('Не удалось загрузить ещё публикации. Попробуйте снова.')
    } finally {
      // setLoadingMore(false) только если этот контроллер всё ещё активный.
      // Если он был aborted и заменён новым — новый сам управляет своим состоянием.
      if (loadMoreAbortRef.current === controller) {
        loadMoreAbortRef.current = null
        setLoadingMore(false)
      }
    }
  }, [])

  // Обёртка loadMore с детекцией стагнации клиентской фильтрации.
  // Если страница загружена, но ни один новый пост не прошёл фильтр —
  // устанавливает isScrollStalled, скрывает sentinel, показывает ручной CTA.
  const loadMoreWithStallDetection = useCallback(async () => {
    const { posts: postsBefore, activeCategory: cat } = useFeedStore.getState()
    const visibleBefore =
      cat === 'all' ? postsBefore.length : postsBefore.filter((p) => p.category === cat).length

    await loadMore()

    const storeAfter = useFeedStore.getState()
    // Игнорируем результат если категория сменилась во время запроса
    if (storeAfter.activeCategory !== cat) return

    if (storeAfter.hasMore && !storeAfter.error) {
      const visibleAfter =
        cat === 'all'
          ? storeAfter.posts.length
          : storeAfter.posts.filter((p) => p.category === cat).length

      if (visibleAfter === visibleBefore) {
        // Страница не добавила видимых постов — останавливаем автопрокрутку
        setIsScrollStalled(true)
      } else {
        // Новые видимые посты найдены — возобновляем автопрокрутку
        setIsScrollStalled(false)
      }
    }
  }, [loadMore])

  const handleRetry = useCallback(() => {
    if (useFeedStore.getState().posts.length === 0) {
      void loadInitial()
      return
    }
    void loadMoreWithStallDetection()
  }, [loadInitial, loadMoreWithStallDetection])

  // IntersectionObserver для infinite scroll (AC #2).
  // Пересоздаётся при изменении hasMore, error, isScrollStalled.
  // При isScrollStalled=true observer не создаётся — используется ручной CTA.
  useEffect(() => {
    if (!observerRef.current || !hasMore || error || isScrollStalled) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void loadMoreWithStallDetection()
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(observerRef.current)
    return () => observer.disconnect()
  }, [error, hasMore, isScrollStalled, loadMoreWithStallDetection])

  // Клиентская фильтрация по категории (серверная — в Story 2.4).
  // Мемоизация предотвращает лишний .filter() на каждом ре-рендере.
  const displayedPosts = useMemo(
    () => (activeCategory === 'all' ? posts : posts.filter((p) => p.category === activeCategory)),
    [posts, activeCategory]
  )

  // Защита гидрации: ждём пока AuthProvider инициализирует store
  if (!isAuthReady) {
    return (
      <div role="status" aria-label="Загрузка приложения">
        <Skeletons count={5} context="hydration" />
      </div>
    )
  }

  // Состояние начальной загрузки — скелетоны (AC #3)
  if (isLoading) {
    return (
      <div role="status" aria-label="Загрузка ленты">
        <Skeletons count={5} context="initial" />
      </div>
    )
  }

  if (error && posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <p className="font-heading text-xl font-semibold text-foreground">
          Не удалось загрузить ленту
        </p>
        <p className="mt-2 text-sm text-muted-foreground">Проверьте соединение и попробуйте снова</p>
        <button
          type="button"
          onClick={handleRetry}
          className="mt-4 min-h-[44px] rounded-md border border-border px-4 py-2 text-sm font-medium"
        >
          Повторить
        </button>
      </div>
    )
  }

  // Нет отображаемых постов для текущей категории
  if (displayedPosts.length === 0) {
    // Ещё подгружаем страницы в поисках постов данной категории — скелетоны вместо пустого экрана
    if (isLoadingMore) {
      return (
        <div role="status" aria-label="Загрузка ленты">
          <Skeletons count={5} context="initial" />
        </div>
      )
    }
    // hasMore=false: постов с такой категорией нет → empty state (AC #5)
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <p className="font-heading text-xl font-semibold text-foreground">
          {error ? 'Не удалось загрузить публикации' : 'Скоро здесь появится контент'}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {error
            ? 'Попробуйте ещё раз, чтобы продолжить загрузку'
            : 'Следите за обновлениями клуба'}
        </p>
        {(error || (hasMore && activeCategory !== 'all')) && (
          <button
            type="button"
            onClick={handleRetry}
            className="mt-4 min-h-[44px] rounded-md border border-border px-4 py-2 text-sm font-medium"
          >
            {error ? 'Повторить' : 'Загрузить ещё'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Список постов (AC #1) */}
      <ul aria-label="Лента публикаций">
        {displayedPosts.map((post, index) => (
          <li key={post.id}>
            <PostCard post={dbPostToCardData(post, currentUserId)} priority={index < 2} />
          </li>
        ))}
      </ul>

      {/* Скелетоны при подгрузке следующей страницы (AC #3) */}
      {isLoadingMore && (
        <div role="status" aria-label="Загрузка новых постов">
          <Skeletons count={3} context="more" />
        </div>
      )}

      {error && (
        <div className="px-4 py-4 text-center" role="alert">
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-3 min-h-[44px] rounded-md border border-border px-4 py-2 text-sm font-medium"
          >
            Повторить
          </button>
        </div>
      )}

      {/* Trigger infinite scroll (AC #2) — sentinel в DOM пока есть ещё данные и нет stall */}
      {hasMore && !error && !isScrollStalled && (
        <div ref={observerRef} aria-hidden="true" data-testid="feed-sentinel" className="h-px w-full" />
      )}

      {/* Ручной CTA когда автопрокрутка застряла на редкой категории */}
      {hasMore && !error && isScrollStalled && (
        <div className="px-4 py-4 text-center">
          <button
            type="button"
            onClick={handleRetry}
            className="min-h-[44px] rounded-md border border-border px-4 py-2 text-sm font-medium"
          >
            Загрузить ещё
          </button>
        </div>
      )}

      {/* End of feed message (AC #4) */}
      {!hasMore && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Вы просмотрели все публикации
        </p>
      )}
    </div>
  )
}
