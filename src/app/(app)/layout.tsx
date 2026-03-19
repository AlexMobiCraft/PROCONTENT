import { redirect } from 'next/navigation'

import { AuthProvider } from '@/features/auth/components/AuthProvider'
import { MobileNav } from '@/components/navigation/MobileNav'
import { createClient } from '@/lib/supabase/server'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  return (
    <AuthProvider user={user} session={session}>
      {children}
      <MobileNav />
    </AuthProvider>
  )
}
