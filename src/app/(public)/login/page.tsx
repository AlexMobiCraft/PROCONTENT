import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { AuthContainer } from '@/features/auth/components/AuthContainer'

export const metadata: Metadata = {
  title: 'Войти | PROCONTENT',
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
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Suspense>
          <AuthContainer />
        </Suspense>
      </div>
    </main>
  )
}
