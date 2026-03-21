import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { UpdatePasswordForm } from '@/features/auth/components/UpdatePasswordForm'

export const metadata: Metadata = {
  title: 'Nastavitev gesla | PROCONTENT',
  description: 'Ustvarite varno geslo za dostop do kluba',
}

export default async function UpdatePasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <UpdatePasswordForm />
      </div>
    </main>
  )
}
