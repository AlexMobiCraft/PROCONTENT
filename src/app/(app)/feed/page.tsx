'use client'

import { useRouter } from 'next/navigation'

import { signOut } from '@/features/auth/api/auth'
import { useAuthStore } from '@/features/auth/store'

export default function FeedPage() {
  const router = useRouter()
  const clearAuth = useAuthStore((state) => state.clearAuth)

  async function handleSignOut() {
    await signOut()
    clearAuth()
    router.push('/login')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="font-heading text-foreground text-3xl font-semibold">
          Лента
        </h1>
        <p className="text-muted-foreground mt-2">
          Скоро здесь появится контент
        </p>
      </div>

      <button
        onClick={handleSignOut}
        className="inline-flex items-center justify-center border border-border px-6 py-2.5 font-sans text-xs font-medium tracking-[0.2em] uppercase text-foreground transition-colors hover:bg-muted"
      >
        Выйти
      </button>
    </main>
  )
}
