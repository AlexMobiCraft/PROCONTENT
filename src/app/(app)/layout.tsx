import { redirect } from 'next/navigation'

import { AuthProvider } from '@/features/auth/components/AuthProvider'
import { MobileNav } from '@/components/navigation/MobileNav'
import { DesktopSidebar } from '@/components/navigation/DesktopSidebar'
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
      <div className="md:mx-auto md:flex md:max-w-[1200px]">
        <DesktopSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      <div className="md:hidden">
        <MobileNav />
      </div>
    </AuthProvider>
  )
}
