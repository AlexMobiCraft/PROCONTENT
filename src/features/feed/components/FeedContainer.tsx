'use client'

import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAuthStore } from '@/features/auth/store'
import { PostCard, PostCardSkeleton } from '@/components/feed/PostCard'
import { createClient } from '@/lib/supabase/client'
import { getAdminPostEditPath } from '@/lib/app-routes'
import { deletePost } from '@/features/admin/api/posts'
import { fetchPosts } from '../api/posts'
import { useFeedStore } from '../store'
import { dbPostToCardData, type FeedPage, type ToggleLikeResponse } from '../types'

function Skeletons({
  count,
  context,
  showMedia = false,
}: {
  count: number
  context: string
  showMedia?: boolean | 'alternate'
}) {
  return Array.from({ length: count }).map((_, i) => (
    <PostCardSkeleton
      key={`${context}-${i}`}
      showMedia={showMedia === 'alternate' ? i % 2 === 0 : showMedia}
    />
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

// Максимальное количество последовательных пустых страниц до показа CTA.
// Константа вынесена на уровень модуля — не пересоздаётся при каждом рендере.
const MAX_STALL_RETRIES = 3

// rootMargin для IntersectionObserver sentinel бесконечной прокрутки.
const SENTINEL_ROOT_MARGIN = '200px'

export function FeedContainer({
  initialData,
  initialUserId,
  initialUserRole,
  onCommentClick,
}: {
  initialData?: FeedPage
  initialUserId?: string | null
  initialUserRole?: string | null
  onCommentClick?: (postId: string) => void
} = {}) {
  // Индивидуальные селекторы — компонент перерисовывается только при изменении
  // нужных полей, а не при любом изменении store
  const storePosts = useFeedStore((s) => s.posts)
  const storeHasMore = useFeedStore((s) => s.hasMore)
  const storeIsLoading = useFeedStore((s) => s.isLoading)
  const isLoadingMore = useFeedStore((s) => s.isLoadingMore)
  const storeError = useFeedStore((s) => s.error)
  const activeCategory = useFeedStore((s) => s.activeCategory)
  const currentUser = useAuthStore((state) => state.user)
  const currentUserId = currentUser?.id ?? null
  const pendingLikes = useFeedStore((s) => s.pendingLikes)
  const router = useRouter()

  const isAuthReady = useAuthStore((state) => state.isReady)
  const resolvedUserId = isAuthReady ? currentUserId : (initialUserId ?? null)
  const resolvedUserRole = initialUserRole ?? null

  const initialLoadAbortRef = useRef<AbortController | null>(null)
  const loadMoreAbortRef = useRef<AbortController | null>(null)
  // Активный IntersectionObserver и наблюдаемый узел sentinel.
  // Используем callback ref (а не useRef + useEffect), чтобы observer корректно
  // переподключался к новому DOM-узлу sentinel когда тот пересоздаётся между
  // переходами loading↔loaded состояний.
  const observerInstanceRef = useRef<IntersectionObserver | null>(null)
  const sentinelNodeRef = useRef<HTMLDivElement | null>(null)
  // Отслеживаем предыдущее значение activeCategory, чтобы отличать реальную смену
  // категории от первого маунта. Без этого category effect сбрасывал store на
  // маунте после гидрации (или preset в тестах) и обрывал infinite scroll
  // (баг "лента из 10 постов").
  const previousCategoryRef = useRef<string | null>(null)

  // Количество последовательных stall-загрузок. Sentinel остаётся активным
  // пока stallCount < MAX_STALL_RETRIES — автопрокрутка без ручного CTA.
  const [stallCount, setStallCount] = useState(0)

  // Явный флаг завершения SSR→CSR гидрации.
  // false до выполнения useEffect → первый render использует initialData напрямую.
  // true после useEffect → используем store (который уже содержит initialData).
  // Если initialData отсутствует — сразу true, используем store.
  const [isHydrated, setIsHydrated] = useState(() => !initialData)

  // SSR-safe гидрация store из серверных данных.
  // useEffect выполняется только на клиенте — не мутирует глобальный Zustand
  // singleton во время серверного рендера (fix: SSR state leak между запросами).
  // initialData в deps: при возврате на страницу (новый SSR-рендер) store
  // обновляется свежими данными, а не показывает stale кэш (fix: stale SSR data).
  // Проверка `> 0` убрана: пустые initialData.posts тоже должны очищать stale кэш.
  useEffect(() => {
    if (initialData) {
      useFeedStore.getState().setPosts(
        initialData.posts,
        initialData.nextCursor,
        initialData.hasMore
      )
      useFeedStore.getState().setLoading(false)
    }
    setIsHydrated(true)
  }, [initialData])

  // До гидрации (useEffect ещё не выполнился): первый render использует initialData
  // напрямую — нет flash скелетонов и нет показа stale store.
  // После гидрации (isHydrated=true): store синхронизирован с initialData, используем store.
  // useMemo стабилизирует ссылку на массив posts — без этого условный массив
  // пересоздаётся каждый render и делает deps useMemo(displayedPosts) нестабильными.
  const posts = useMemo(
    () => (isHydrated ? storePosts : (initialData?.posts ?? [])),
    [isHydrated, storePosts, initialData?.posts]
  )
  const hasMore = isHydrated ? storeHasMore : (initialData?.hasMore ?? true)
  const isLoading = isHydrated ? storeIsLoading : false
  const error = isHydrated ? storeError : null

  const loadInitial = useCallback(async () => {
    initialLoadAbortRef.current?.abort()
    const controller = new AbortController()
    initialLoadAbortRef.current = controller

    useFeedStore.getState().setLoading(true)
    useFeedStore.getState().setError(null)
    try {
      const { posts: newPosts, nextCursor, hasMore } = await fetchPosts(undefined, {
        signal: controller.signal,
        category: useFeedStore.getState().activeCategory,
      })
      if (controller.signal.aborted) return
      useFeedStore.getState().setPosts(newPosts, nextCursor, hasMore)
    } catch (err) {
      if (isAbortError(err)) return
      console.error('Ошибка загрузки ленты:', err)
      useFeedStore.getState().setError('Nalaganje vsebine ni uspelo. Poskusite znova.')
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
    const previousCategory = previousCategoryRef.current
    previousCategoryRef.current = activeCategory
    const isFirstMount = previousCategory === null

    if (!isFirstMount && previousCategory !== activeCategory) {
      // Реальная смена категории (пользователь кликнул таб): всегда сбрасываем
      // store и перезагружаем — посты из предыдущего фильтра не подходят
      // для новой категории. Это закрывает баг сброса фильтра "VSE" при
      // возврате из отфильтрованной категории (commit ad1bb55e).
      useFeedStore.getState().setPosts([], null, true)
      void loadInitial()
    } else if (isFirstMount) {
      // Первый маунт: воспроизводим pre-ad1bb55e логику, чтобы не трогать
      // свежеотгидрированные SSR-данные и не обрывать IntersectionObserver
      // (баг "лента из 10 постов": observer оставался привязан к удалённому
      // sentinel-узлу, пока скелетоны перекрывали ленту).
      //
      // • Для 'all' — грузим ТОЛЬКО если store пуст и нет initialData.
      //   Это путь инициализации fresh-рендера без SSR.
      // • Для остальных категорий — всегда сбрасываем и подгружаем: SSR
      //   отдаёт страницу под 'all', а store после SPA-навигации мог быть
      //   переключён на другую категорию.
      if (activeCategory !== 'all') {
        useFeedStore.getState().setPosts([], null, true)
        void loadInitial()
      } else {
        const storeHasPosts = useFeedStore.getState().posts.length > 0
        if (!storeHasPosts && !initialData) {
          void loadInitial()
        }
      }
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
  }, [activeCategory, loadInitial, initialData])

  // Сбрасываем счётчик stall при смене категории
  useEffect(() => {
    setStallCount(0)
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
      } = await fetchPosts(cursor, { signal: controller.signal, category: categoryBefore })
      // Guard: если запрос отменён или категория сменилась — не добавлять stale данные
      if (controller.signal.aborted) return
      if (useFeedStore.getState().activeCategory !== categoryBefore) return
      appendPosts(newPosts, nextCursor, more)
    } catch (err) {
      if (isAbortError(err)) return
      console.error('Ошибка подгрузки постов:', err)
      setError('Nalaganje nadaljnjih objav ni uspelo. Poskusite znova.')
    } finally {
      if (loadMoreAbortRef.current === controller) {
        loadMoreAbortRef.current = null
        setLoadingMore(false)
      }
    }
  }, [])

  // Обёртка loadMore с детекцией стагнации клиентской фильтрации.
  // Если страница загружена, но ни один новый пост не прошёл фильтр —
  // увеличивает stallCount. Sentinel остаётся активным пока < MAX_STALL_RETRIES.
  const loadMoreWithStallDetection = useCallback(async () => {
    if (useFeedStore.getState().isLoadingMore) return

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
        // Стагнация: инкрементируем счётчик — sentinel остаётся активным
        setStallCount((c) => c + 1)
      } else {
        // Новые видимые посты найдены — сбрасываем счётчик
        setStallCount(0)
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

  // Сброс счётчика стагнации — возобновляет автопоиск без перезагрузки страницы.
  const handleSearchMore = useCallback(() => {
    setStallCount(0)
  }, [])

  // IntersectionObserver для infinite scroll (AC #2).
  // Sentinel активен пока stallCount < MAX_STALL_RETRIES — автопрокрутка
  // без ручного CTA (fix: автопоиск обрывается после первой пустой страницы).
  // При isLoadingMore=true observer отключается: после завершения подгрузки
  // эффект пересоздаёт observer, который немедленно сработает если sentinel в viewport.
  //
  // Observer создаётся в useEffect (с deps на условия активации), а подписка
  // на конкретный DOM-узел делается через callback ref `setSentinelRef`.
  // Это критично: между переходами loading↔loaded sentinel-узел пересоздаётся
  // (другой DOM-элемент при rerender), и без callback ref наблюдатель оставался
  // бы подписан на отсоединённый узел — infinite scroll ломался после первой
  // страницы (баг "лента из 10 постов").
  useEffect(() => {
    if (!hasMore || error || isLoadingMore || stallCount >= MAX_STALL_RETRIES) {
      observerInstanceRef.current?.disconnect()
      observerInstanceRef.current = null
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void loadMoreWithStallDetection()
        }
      },
      { rootMargin: SENTINEL_ROOT_MARGIN }
    )
    observerInstanceRef.current = observer
    // Если sentinel-узел уже смонтирован к этому моменту — сразу его наблюдаем.
    if (sentinelNodeRef.current) {
      observer.observe(sentinelNodeRef.current)
    }
    return () => {
      observer.disconnect()
      if (observerInstanceRef.current === observer) {
        observerInstanceRef.current = null
      }
    }
  }, [error, hasMore, isLoadingMore, stallCount, loadMoreWithStallDetection])

  // Callback ref для sentinel-узла. Вызывается React при mount/unmount узла.
  // Переподключает текущий IntersectionObserver к новому DOM-элементу — это
  // нужно потому, что sentinel размонтируется на время загрузки (скелетоны).
  const setSentinelRef = useCallback((node: HTMLDivElement | null) => {
    const previousNode = sentinelNodeRef.current
    sentinelNodeRef.current = node
    const observer = observerInstanceRef.current
    if (!observer) return
    if (previousNode && previousNode !== node) {
      observer.unobserve(previousNode)
    }
    if (node) {
      observer.observe(node)
    }
  }, [])

  // Серверная фильтрация по категории (передаём в fetchPosts).
  // displayedPosts = posts напрямую (уже отфильтрованы на сервере).
  const displayedPosts = useMemo(
    () => posts,
    [posts]
  )

  // Мемоизация маппинга — стабильные ссылки на объекты, нет лишних рендеров PostCard.
  // resolvedUserId (не currentUserId) предотвращает badge pop-in при гидрации auth store.
  const cardDataList = useMemo(
    () => displayedPosts.map((post) => dbPostToCardData(post, resolvedUserId)),
    [displayedPosts, resolvedUserId]
  )

  // --- handleLikeToggle: оптимистичное обновление + RPC sync ---
  const handleLikeToggle = useCallback(
    async (postId: string) => {
      // 1) Проверка авторизации — гость → перенаправить на /login
      if (!currentUser) {
        router.push('/login')
        return
      }

      // 2) Блокировка спама: если уже pending — выходим
      const store = useFeedStore.getState()
      if (store.pendingLikes.includes(postId)) return

      // 3) Сохраняем старое состояние для rollback
      const post = store.posts.find((p) => p.id === postId)
      if (!post) return
      const prevIsLiked = post.is_liked ?? false
      const prevLikesCount = post.likes_count

      // 4) Оптимистичное обновление + добавляем в pending
      const newIsLiked = !prevIsLiked
      store.addPendingLike(postId)
      store.updatePost(postId, {
        is_liked: newIsLiked,
        likes_count: prevLikesCount + (newIsLiked ? 1 : -1),
      })

      try {
        // 5) Вызов RPC
        const supabase = createClient()
        const { data, error } = await supabase.rpc('toggle_like', {
          p_post_id: postId,
        })

        if (error) throw error

        // 6) Синхронизация с ответом сервера (Source of Truth)
        const result = data as unknown as ToggleLikeResponse
        useFeedStore.getState().updatePost(postId, {
          is_liked: result.is_liked,
          likes_count: result.likes_count,
        })
      } catch (err) {
        console.error('Ошибка toggle_like:', err)
        // 7) Rollback к сохранённым значениям
        useFeedStore.getState().updatePost(postId, {
          is_liked: prevIsLiked,
          likes_count: prevLikesCount,
        })
      } finally {
        // 8) Убираем из pending
        useFeedStore.getState().removePendingLike(postId)
      }
    },
    [currentUser, router]
  )

  const handleOptionsClick = useCallback(
    async (postId: string) => {
      if (!currentUser) {
        router.push('/login')
        return
      }

      const post = useFeedStore.getState().posts.find((item) => item.id === postId)
      if (!post) return

      const canDelete = post.author_id === currentUser.id || resolvedUserRole === 'admin'

      if (!canDelete) {
        toast.error('Objavo lahko izbriše avtorica ali admin')
        return
      }

      try {
        await deletePost(postId)
        useFeedStore.getState().removePost(postId)
        toast.success('Objava je bila izbrisana')
      } catch (error) {
        console.error('Napaka pri brisanju objave:', error)
        toast.error('Brisanje objave ni uspelo')
      }
    },
    [currentUser, resolvedUserRole, router]
  )

  // Auto-trigger loadMore когда displayedPosts.length === 0 и sentinel в DOM,
  // но IO не срабатывает повторно (sentinel не уходил из viewport между пересозданиями).
  // Fix: "нулевой рост sentinel не триггерит observer при фильтрах".
  useEffect(() => {
    if (
      !isLoadingMore &&
      displayedPosts.length === 0 &&
      hasMore &&
      !error &&
      stallCount < MAX_STALL_RETRIES
    ) {
      const id = setTimeout(() => void loadMoreWithStallDetection(), 500)
      return () => clearTimeout(id)
    }
  }, [isLoadingMore, displayedPosts.length, hasMore, error, stallCount, loadMoreWithStallDetection])

  // Защита гидрации: ждём пока AuthProvider инициализирует store.
  // Если посты уже есть в кэше — рендерим их сразу (priority-изображения
  // прелоадятся браузером, не ломается LCP NFR1).
  if (!isAuthReady && posts.length === 0) {
    return (
      <div role="status" aria-label="Nalaganje aplikacije">
        <Skeletons count={5} context="hydration" showMedia="alternate" />
      </div>
    )
  }

  // Состояние начальной загрузки — скелетоны (AC #3)
  if (isLoading) {
    return (
      <div role="status" aria-label="Nalaganje vsebine">
        <Skeletons count={5} context="initial" showMedia="alternate" />
      </div>
    )
  }

  if (error && posts.length === 0) {
    return (
      <div role="alert" className="flex flex-col items-center justify-center min-h-[60vh] py-20 px-4 text-center">
        <p className="font-heading text-xl font-semibold text-foreground">
          Nalaganje vsebine ni uspelo
        </p>
        <p className="mt-2 text-sm text-muted-foreground">Preverite povezavo in poskusite znova</p>
        <button
          type="button"
          onClick={handleRetry}
          className="mt-4 min-h-[44px] rounded-md border border-border px-4 py-2 text-sm font-medium"
        >
          Ponovi
        </button>
      </div>
    )
  }

  // Нет отображаемых постов для текущей категории
  if (displayedPosts.length === 0) {
    // Ещё подгружаем страницы в поисках постов данной категории — скелетоны вместо пустого экрана
    if (isLoadingMore) {
      return (
        <div role="status" aria-label="Nalaganje vsebine">
          <Skeletons count={5} context="initial" showMedia="alternate" />
        </div>
      )
    }
    // hasMore=false: постов с такой категорией нет → empty state (AC #5)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] py-20 px-4 text-center">
        <p className="font-heading text-xl font-semibold text-foreground">
          {error ? 'Nalaganje objav ni uspelo' : 'Kmalu bo tu vsebina'}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {error
            ? 'Poskusite znova za nadaljevanje nalaganja'
            : 'Sledite posodobitvam kluba'}
        </p>
        {error && (
          <button
            type="button"
            onClick={handleRetry}
            className="mt-4 min-h-[44px] rounded-md border border-border px-4 py-2 text-sm font-medium"
          >
            Ponovi
          </button>
        )}
        {/* Sentinel остаётся активным пока есть страницы и не исчерпаны попытки —
            auto-scroll и auto-trigger продолжают искать посты нужной категории */}
        {hasMore && !error && stallCount < MAX_STALL_RETRIES && (
          <div
            ref={setSentinelRef}
            aria-hidden="true"
            data-testid="feed-sentinel"
            className="h-px w-full"
          />
        )}
        {/* После MAX_STALL_RETRIES — предлагаем пользователю продолжить поиск вручную */}
        {hasMore && !error && stallCount >= MAX_STALL_RETRIES && (
          <button
            type="button"
            onClick={handleSearchMore}
            className="mt-4 min-h-[44px] rounded-md border border-border px-4 py-2 text-sm font-medium"
          >
            Išči naprej
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Список постов (AC #1) */}
      <ul aria-label="Feed objav">
        {cardDataList.map((cardData, index) => (
          <li key={cardData.id}>
            <PostCard
              post={cardData}
              priority={index < 2}
              isPending={pendingLikes.includes(cardData.id)}
              canManage={Boolean(resolvedUserId && (resolvedUserId === displayedPosts[index]?.author_id || resolvedUserRole === 'admin'))}
              canEdit={resolvedUserId === displayedPosts[index]?.author_id}
              editHref={resolvedUserId === displayedPosts[index]?.author_id ? getAdminPostEditPath(cardData.id) : undefined}
              onLikeToggle={handleLikeToggle}
              onCommentClick={onCommentClick}
              onOptionsClick={handleOptionsClick}
              onCategoryClick={(category) => useFeedStore.getState().changeCategory(category)}
            />
          </li>
        ))}
      </ul>

      {/* Скелетоны при подгрузке следующей страницы (AC #3) */}
      {isLoadingMore && (
        <div role="status" aria-label="Nalaganje novih objav">
          <Skeletons count={3} context="more" showMedia="alternate" />
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
            Ponovi
          </button>
        </div>
      )}

      {/* Sentinel активен пока stallCount < MAX_STALL_RETRIES —
          автопрокрутка без ручного CTA (fix: автопоиск обрывается при empty state) */}
      {hasMore && !error && stallCount < MAX_STALL_RETRIES && (
        <div
          ref={setSentinelRef}
          aria-hidden="true"
          data-testid="feed-sentinel"
          className="h-px w-full"
        />
      )}

      {/* После MAX_STALL_RETRIES неудачных попыток — предлагаем продолжить поиск вручную */}
      {hasMore && !error && stallCount >= MAX_STALL_RETRIES && (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            V tej kategoriji ni več objav
          </p>
          <button
            type="button"
            onClick={handleSearchMore}
            className="mt-3 min-h-[44px] rounded-md border border-border px-4 py-2 text-sm font-medium"
          >
            Išči naprej
          </button>
        </div>
      )}

      {/* End of feed message (AC #4) */}
      {!hasMore && (
        <p role="status" aria-live="polite" className="py-8 text-center text-sm text-muted-foreground">
          Pregledali ste vse objave
        </p>
      )}
    </div>
  )
}
