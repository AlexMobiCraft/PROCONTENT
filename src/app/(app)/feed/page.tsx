'use client'

import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { signOut } from '@/features/auth/api/auth'

export default function FeedPage() {
  const router = useRouter()

  async function handleSignOut() {
    await signOut()
    router.push('/login')
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
