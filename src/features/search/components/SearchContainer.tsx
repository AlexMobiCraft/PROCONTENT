'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PostCard, PostCardSkeleton } from '@/components/feed/PostCard'
import { dbPostToCardData } from '@/features/feed/types'
import { useAuthStore } from '@/features/auth/store'
import { searchPosts } from '../api/search'
import { useDebounce } from '@/hooks/useDebounce'
import { useLikeToggle } from '@/hooks/useLikeToggle'
import { Input } from '@/components/ui/input'
import type { Post } from '@/features/feed/types'

const MIN_QUERY_LENGTH = 3

// ---------- SearchInput ----------

interface SearchInputProps {
  value: string
  onChange: (v: string) => void
}

function SearchInput({ value, onChange }: SearchInputProps) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
        <svg
          className="size-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
      </span>
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Iskanje po vsebini…"
        aria-label="Iskanje po vsebini"
        className="pl-10 pr-4"
      />
    </div>
  )
}

// ---------- EmptyState ----------

function EmptyState({ query }: { query: string }) {
  if (!query.trim()) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <svg
            className="size-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
        </div>
        <p className="font-heading text-lg font-semibold text-foreground">Iskanje po arhivu</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Vpišite ključne besede in poiščite vsebino
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <svg
          className="size-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
      </div>
      <p className="font-heading text-lg font-semibold text-foreground">Ni zadetkov</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Za iskalni niz <span className="font-medium text-foreground">&ldquo;{query}&rdquo;</span>{' '}
        nismo našli nobene vsebine
      </p>
    </div>
  )
}

// ---------- SearchSkeletons ----------

function SearchSkeletons() {
  return (
    <div role="status" aria-label="Iskanje…">
      {Array.from({ length: 4 }).map((_, i) => (
        <PostCardSkeleton key={i} showMedia={i % 2 === 0} />
      ))}
    </div>
  )
}

// ---------- SearchContainer ----------

export function SearchContainer({ initialQuery = '' }: { initialQuery?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [inputValue, setInputValue] = useState(() => searchParams.get('q') ?? initialQuery)
  const [results, setResults] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isUserInputRef = useRef(false)
  const resultsCache = useRef<Map<string, Post[]>>(new Map())

  const debouncedQuery = useDebounce(inputValue, 400)

  const currentUser = useAuthStore((s) => s.user)
  const currentUserId = currentUser?.id ?? null

  const { pendingLikes, handleLikeToggle } = useLikeToggle({
    posts: results,
    setPosts: setResults,
    currentUser,
  })

  function handleInputChange(v: string) {
    isUserInputRef.current = true
    setInputValue(v)
  }

  // Синхронизация URL ?q= → inputValue (только при навигации Назад/Вперёд)
  useEffect(() => {
    if (isUserInputRef.current) {
      isUserInputRef.current = false
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: syncing external state (URL params) into React state
    setInputValue(searchParams.get('q') ?? '')
  }, [searchParams])

  // Синхронизация inputValue → URL ?q= (при изменении поискового запроса)
  useEffect(() => {
    const q = debouncedQuery.trim()
    router.replace(q ? `/search?q=${encodeURIComponent(q)}` : '/search', { scroll: false })
  }, [debouncedQuery, router])

  // Выполняем поиск при изменении debouncedQuery
  useEffect(() => {
    if (debouncedQuery.trim().length < MIN_QUERY_LENGTH) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: clear results when query is too short
      setResults([])
      setError(null)
      setIsLoading(false)
      return
    }

    const cacheKey = debouncedQuery.trim()
    const cached = resultsCache.current.get(cacheKey)
    if (cached) {
      setResults(cached)
      setError(null)
      return
    }

    const controller = new AbortController()

    setIsLoading(true)
    setError(null)

    searchPosts(debouncedQuery, { signal: controller.signal })
      .then((posts) => {
        if (controller.signal.aborted) return
        if (resultsCache.current.size >= 20) {
          const firstKey = resultsCache.current.keys().next().value
          if (firstKey !== undefined) resultsCache.current.delete(firstKey)
        }
        resultsCache.current.set(cacheKey, posts)
        setResults(posts)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        console.error('Ошибка поиска:', err)
        setError('Iskanje ni uspelo. Poskusite znova.')
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => {
      controller.abort()
    }
  }, [debouncedQuery])

  const showEmpty = !isLoading && !error && results.length === 0
  const hasQuery = debouncedQuery.trim().length >= MIN_QUERY_LENGTH
  const showHint = inputValue.trim().length > 0 && inputValue.trim().length < MIN_QUERY_LENGTH

  return (
    <div className="flex flex-col">
      {/* Search input */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
        <SearchInput value={inputValue} onChange={handleInputChange} />
        {showHint && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Vpišite vsaj {MIN_QUERY_LENGTH} znake za iskanje
          </p>
        )}
      </div>

      {/* Content */}
      <div>
        {isLoading && <SearchSkeletons />}

        {error && (
          <div role="alert" className="px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        )}

        {!isLoading && !error && results.length > 0 && (
          <ul aria-label="Rezultati iskanja">
            {results.map((post, index) => (
              <li key={post.id}>
                <PostCard
                  post={dbPostToCardData(post, currentUserId)}
                  priority={index < 2}
                  isPending={pendingLikes.includes(post.id)}
                  onLikeToggle={handleLikeToggle}
                />
              </li>
            ))}
          </ul>
        )}

        {showEmpty && <EmptyState query={hasQuery ? debouncedQuery : ''} />}
      </div>
    </div>
  )
}
