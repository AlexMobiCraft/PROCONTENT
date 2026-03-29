import { redirect } from 'next/navigation'
import { AuthProvider } from '@/features/auth/components/AuthProvider'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') {
    redirect('/feed')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const session = sessionData?.session

  return (
    <AuthProvider user={user} session={session}>
      {children}
    </AuthProvider>
  )
}
