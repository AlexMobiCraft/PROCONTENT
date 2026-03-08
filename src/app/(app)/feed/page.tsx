'use client'

import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { signOut } from '@/features/auth/api/auth'
import { useAuthStore } from '@/features/auth/store'

export default function FeedPage() {
  const router = useRouter()
  const clearAuth = useAuthStore((state) => state.clearAuth)

  async function handleSignOut() {
    await signOut()
    clearAuth()
    router.push('/login')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="font-heading text-3xl font-semibold text-foreground">
          Лента
        </h1>
        <p className="mt-2 text-muted-foreground">Скоро здесь появится контент</p>
      </div>

      <Button variant="outline" onClick={handleSignOut}>
        Выйти
      </Button>
    </main>
  )
}
