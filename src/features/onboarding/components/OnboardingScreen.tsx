'use client'

import Link from 'next/link'
import { ArrowRight, MessageCircle } from 'lucide-react'

import { OnboardingPostCard } from './OnboardingPostCard'

type Post = {
  id: string
  title: string
  category: string
  type: 'video' | 'photo' | 'text'
}

interface OnboardingScreenProps {
  posts: readonly Post[]
  whatsappUrl: string
}

export function OnboardingScreen({ posts, whatsappUrl }: OnboardingScreenProps) {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-xl px-5 py-16">
        {/* Приветственный блок */}
        <section className="mb-16" aria-label="Приветствие">
          <h1
            className="font-heading font-light uppercase leading-none text-foreground"
            style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)' }}
          >
            Привет, ты теперь часть PROCONTENT!
          </h1>
          <p className="mt-4 font-sans text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Мы рады, что ты здесь. Вот с чего начать:
          </p>
        </section>

        {/* WhatsApp CTA */}
        <section className="mb-16" aria-label="WhatsApp-группа">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Вступить в WhatsApp-группу сообщества"
            className="inline-flex min-h-[44px] items-center gap-3 border border-primary px-8 py-3 font-sans text-xs font-medium uppercase tracking-[0.2em] text-foreground transition-colors hover:bg-primary/10"
          >
            <MessageCircle className="h-4 w-4 text-primary" aria-hidden="true" />
            Вступить в WhatsApp-группу
          </a>
        </section>

        {/* Топ-5 постов */}
        <section aria-label="Топ-5 постов для старта">
          <h2 className="mb-6 font-heading text-2xl font-light uppercase leading-none text-foreground">
            Начни здесь
          </h2>
          <nav aria-label="Список рекомендованных постов">
            {posts.map((post) => (
              <OnboardingPostCard
                key={post.id}
                id={post.id}
                title={post.title}
                category={post.category}
                type={post.type}
              />
            ))}
          </nav>
        </section>

        {/* CTA в ленту */}
        <div className="mt-16">
          <Link
            href="/feed"
            className="inline-flex min-h-[44px] items-center gap-2 border border-primary px-8 py-3 font-sans text-xs font-medium uppercase tracking-[0.2em] text-foreground transition-colors hover:bg-primary/10"
          >
            Перейти к ленте
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </main>
  )
}
