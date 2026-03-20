import { fetchInitialPostsServer } from '@/features/feed/api/serverPosts'
import { FeedPageClient } from '@/features/feed/components/FeedPageClient'

// Server Component: загружает первую страницу постов на сервере.
// Это позволяет priority-изображениям первого экрана попасть в исходный HTML —
// браузер preload-ит их немедленно, LCP соответствует NFR1 (≤ 2.5с).
export default async function FeedPage() {
  const initialData = await fetchInitialPostsServer()
  return <FeedPageClient initialData={initialData} />
}
