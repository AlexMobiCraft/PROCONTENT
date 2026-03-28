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
  try {
    const supabase = await createClient()
    const { data, error: userError } = await supabase.auth.getUser()
    const user = data?.user

    if (!user || userError) {
      redirect('/login')
    }

    const { data: sessionData } = await supabase.auth.getSession()
    const session = sessionData?.session

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
  } catch (err) {
    if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) {
      throw err
    }
    console.error('[AppLayout] UNHANDLED EXCEPTION:', err)
    // Fallback simple UI or re-throw to error.tsx
    throw err 
  }
}
