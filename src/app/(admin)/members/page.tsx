import { fetchMembersServer } from '@/features/admin/api/membersServer'
import { MembersContainer } from '@/features/admin/components/MembersContainer'

export const metadata = { title: 'Udeleženke' }

export default async function MembersPage() {
  const members = await fetchMembersServer()

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-2 font-heading text-2xl font-semibold">Udeleženke</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Seznam vseh registriranih udeleženk in upravljanje dostopa.
      </p>

      <MembersContainer initialMembers={members} />
    </main>
  )
}
