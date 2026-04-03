import { fetchScheduledPostsServer } from '@/features/admin/api/postsServer'
import { ScheduledPostsContainer } from '@/features/admin/components/ScheduledPostsContainer'

export const metadata = { title: 'Načrtovane objave' }

export default async function ScheduledPostsPage() {
  const posts = await fetchScheduledPostsServer()

  return (
    <main className="px-4 py-8">
      <h1 className="mb-2 font-heading text-2xl font-semibold">Načrtovane objave</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Seznam vseh objav, ki so načrtovane za objavo v prihodnosti.
      </p>

      <ScheduledPostsContainer initialPosts={posts} />
    </main>
  )
}
