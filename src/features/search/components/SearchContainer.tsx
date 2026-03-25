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

  const [inputValue, setInputValue] = useState(initialQuery)
  const [results, setResults] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const debouncedQuery = useDebounce(inputValue, 400)
  const abortRef = useRef<AbortController | null>(null)

  const currentUser = useAuthStore((s) => s.user)
  const currentUserId = currentUser?.id ?? null

  const { pendingLikes, handleLikeToggle } = useLikeToggle({
    posts: results,
    setPosts: setResults,
    currentUser,
  })

  // Синхронизация inputValue → URL ?q=
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (debouncedQuery.trim()) {
      params.set('q', debouncedQuery)
    } else {
      params.delete('q')
    }
    router.replace(`/search?${params.toString()}`, { scroll: false })
  }, [debouncedQuery, router, searchParams])

  // Выполняем поиск при изменении debouncedQuery
  useEffect(() => {
    if (debouncedQuery.trim().length < MIN_QUERY_LENGTH) {
      setResults([])
      setError(null)
      setIsLoading(false)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setError(null)

    searchPosts(debouncedQuery)
      .then((posts) => {
        if (controller.signal.aborted) return
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

  return (
    <div className="flex flex-col">
      {/* Search input */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
        <SearchInput value={inputValue} onChange={setInputValue} />
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
