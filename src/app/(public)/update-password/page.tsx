import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { UpdatePasswordForm } from '@/features/auth/components/UpdatePasswordForm'

export const metadata = {
  title: 'Установка пароля | ProContent',
  description: 'Придумайте надежный пароль для доступа в клуб',
}

export default async function UpdatePasswordPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
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
