'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { CategoryScroll } from '@/components/feed/CategoryScroll'
import { PostCard, PostCardSkeleton, type PostCardData } from '@/components/feed/PostCard'
import { signOut } from '@/features/auth/api/auth'
import { useAuthStore } from '@/features/auth/store'

// Mock data — будет заменено реальными данными из Supabase
const MOCK_POSTS: PostCardData[] = [
  {
    id: '1',
    category: '#insight',
    title: 'Почему алгоритм Reels продвигает одних и игнорирует других',
    excerpt:
      'Разобрали механику ранжирования коротких видео: что реально влияет на охваты, а что — миф. Спойлер: дело не в хэштегах.',
    date: '12 фев',
    likes: 47,
    comments: 12,
    type: 'text',
    author: { name: 'PROCONTENT', initials: 'PC', isAuthor: true },
  },
  {
    id: '2',
    category: '#разборы',
    title: 'UGC-портфолио: как собрать первые 5 кейсов без бюджета',
    excerpt:
      'Пошаговый гайд: от выбора ниши до питча бренду. Включает шаблон письма, которое работает.',
    date: '8 фев',
    likes: 83,
    comments: 24,
    type: 'text',
    author: { name: 'PROCONTENT', initials: 'PC', isAuthor: true },
  },
  {
    id: '3',
    category: '#съёмка',
    title: 'Свет в помещении: 3 расстановки для контента с телефона',
    excerpt:
      'Кольцевой свет — не единственный вариант. Показываем, как работать с естественным светом из окна, чтобы фотографии выглядели дорого.',
    date: '1 фев',
    likes: 61,
    comments: 18,
    type: 'photo',
    author: { name: 'PROCONTENT', initials: 'PC', isAuthor: true },
  },
  {
    id: '4',
    category: '#reels',
    title: 'Крючок на первые 3 секунды: 7 формул, которые работают',
    excerpt:
      'Если зритель не зацепился в первые 3 секунды — он уже ушёл. Разбираем конкретные формулы начала видео с реальными примерами.',
    date: '25 янв',
    likes: 112,
    comments: 31,
    type: 'video',
    author: { name: 'PROCONTENT', initials: 'PC', isAuthor: true },
  },
  {
    id: '5',
    category: '#бренды',
    title: 'Как правильно называть цену бренду, чтобы не продешевить',
    excerpt:
      'Страх назвать цену — главная проблема начинающих UGC-криэйторов. Разбираем психологию переговоров и конкретные цифры.',
    date: '20 янв',
    likes: 94,
    comments: 27,
    type: 'text',
    author: { name: 'PROCONTENT', initials: 'PC', isAuthor: true },
  },
]

const CATEGORY_MAP: Record<string, string> = {
  insight: '#insight',
  razobory: '#разборы',
  syomka: '#съёмка',
  reels: '#reels',
  brendy: '#бренды',
}

export default function FeedPage() {
  const router = useRouter()
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const [activeCategory, setActiveCategory] = useState('all')
  const [isLoading] = useState(false)

  const filteredPosts =
    activeCategory === 'all'
      ? MOCK_POSTS
      : MOCK_POSTS.filter(
          (p) => p.category === CATEGORY_MAP[activeCategory]
        )

  async function handleSignOut() {
    await signOut()
    clearAuth()
    router.push('/login')
  }

  return (
    <main>
      {/* Top header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-heading text-foreground text-lg font-semibold tracking-tight">
            PROCONTENT
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleSignOut}
            aria-label="Выйти"
          >
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
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
              />
            </svg>
          </Button>
        </div>

        {/* Category filters */}
        <div className="border-t border-border/50 px-4">
          <CategoryScroll
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
        </div>
      </header>

      {/* Feed */}
      {isLoading ? (
        <div>
          {Array.from({ length: 4 }).map((_, i) => (
            <PostCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredPosts.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
          <svg
            className="size-12 text-muted-foreground/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <div className="flex flex-col gap-1">
            <p className="font-medium text-foreground">Постов не найдено</p>
            <p className="text-sm text-muted-foreground">
              Попробуй другую рубрику или сбрось фильтр
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveCategory('all')}
          >
            Показать все посты
          </Button>
        </div>
      ) : (
        <div>
          {filteredPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          {/* End of feed indicator */}
          <div className="py-8 text-center text-sm text-muted-foreground">
            Это все посты в этой рубрике
          </div>
        </div>
      )}
    </main>
  )
}
