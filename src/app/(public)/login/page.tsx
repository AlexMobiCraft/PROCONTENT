import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { AuthContainer } from '@/features/auth/components/AuthContainer'

export const metadata: Metadata = {
  title: 'Войти',
  description: 'Вход в закрытый клуб PROCONTENT',
}

export default async function LoginPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/feed')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <Link
          href="/"
          className="font-sans text-xs tracking-[0.15em] uppercase text-muted-foreground hover:text-foreground transition-colors min-h-[44px] flex items-center w-fit"
        >
          ← Назад
        </Link>
        <AuthContainer />
      </div>
    </main>
  )
}
