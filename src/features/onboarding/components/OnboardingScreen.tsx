'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, MessageCircle } from 'lucide-react'

import { OnboardingPostCard } from './OnboardingPostCard'

type Post = {
  id: string
  title: string
  category: string
  type: string
}

interface OnboardingScreenProps {
  posts: readonly Post[]
  whatsappUrl: string
}

export function OnboardingScreen({ posts, whatsappUrl }: OnboardingScreenProps) {
  return (
    <main className="relative min-h-screen bg-background">
      <div className="fixed inset-0 -z-10">
        <Image
          src="/images/hero-bg.png"
          alt=""
          fill
          className="object-cover object-center opacity-10"
          priority
        />
      </div>
      <div className="mx-auto max-w-xl px-5 py-16">
        {/* Приветственный блок */}
        <section className="mb-16" aria-label="Pozdrav">
          <h1
            className="font-heading font-light uppercase leading-none text-foreground"
            style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)' }}
          >
            Vesela sem, da si z nami 🫶🏼
          </h1>
          <div className="mt-6 space-y-4 font-sans text-sm leading-relaxed text-muted-foreground">
            <p>
              Tukaj sem zate pripravila objave, s katerimi lahko začneš in te bodo korak za korakom
              vodile skozi osnove.
            </p>
            <p>
              Zelo bom vesela vsakega komentarja pod objavo, še posebej pa tvojih vprašanj in dilem,
              povezanih s temo objave.
            </p>
            <p>
              Preden začneš, te lepo vabim, da se pridružiš naši WhatsApp skupini. Ustvarjena je
              zato, da se bližje spoznaš z ostalimi članicami kluba, vprašaš karkoli te zanima in
              preprosto poklepetamo s podobno mislečimi.
            </p>
          </div>
        </section>

        {/* WhatsApp CTA */}
        <section className="mb-16" aria-label="WhatsApp skupina">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Pridruži se WhatsApp skupini skupnosti"
            className="inline-flex min-h-[44px] items-center gap-3 border border-primary px-8 py-3 font-sans text-xs font-medium uppercase tracking-[0.2em] text-foreground transition-colors hover:bg-primary/10"
          >
            <MessageCircle className="h-4 w-4 text-primary" aria-hidden="true" />
            Pridruži se WhatsApp skupini
          </a>
        </section>

        {/* Top-5 objav */}
        <section aria-label="Top-5 objav za začetek">
          <h2 className="mb-6 font-heading text-2xl font-light uppercase leading-none text-foreground">
            Začni tukaj
          </h2>
          <nav aria-label="Seznam priporočenih objav">
            <ul className="flex flex-col">
              {posts.map((post) => (
                <li key={post.id}>
                  <OnboardingPostCard
                    id={post.id}
                    title={post.title}
                    category={post.category}
                    type={post.type}
                  />
                </li>
              ))}
            </ul>
          </nav>
        </section>

        {/* CTA в ленту */}
        <div className="mt-16">
          <Link
            href="/feed"
            className="inline-flex min-h-[44px] items-center gap-2 border border-primary px-8 py-3 font-sans text-xs font-medium uppercase tracking-[0.2em] text-foreground transition-colors hover:bg-primary/10"
          >
            Pojdi na feed
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </main>
  )
}
