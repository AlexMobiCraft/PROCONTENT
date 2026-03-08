import { redirect } from 'next/navigation'

import { AuthProvider } from '@/features/auth/components/AuthProvider'
import { createClient } from '@/lib/supabase/server'
import { MobileNav } from '@/components/navigation/MobileNav'

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

  if (!session) {
    redirect('/login')
  }

  return (
    <AuthProvider user={user} session={session}>
      {/* Bottom nav clearance — 60px nav + safe area */}
      <div className="pb-[76px]">{children}</div>
      <MobileNav />
    </AuthProvider>
  )
}
