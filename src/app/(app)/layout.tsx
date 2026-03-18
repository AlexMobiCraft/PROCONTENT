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

  return (
    <AuthProvider user={user} session={null}>
      {children}
      <MobileNav />
    </AuthProvider>
  )
}
