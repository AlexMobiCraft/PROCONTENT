import { fetchInitialPostsServer } from '@/features/feed/api/serverPosts'
import { FeedPageClient } from '@/features/feed/components/FeedPageClient'

export const dynamic = 'force-dynamic'

// Server Component: загружает первую страницу постов и текущего пользователя на сервере.
// Это позволяет priority-изображениям первого экрана попасть в исходный HTML —
// браузер preload-ит их немедленно, LCP соответствует NFR1 (≤ 2.5с).
// currentUserId передаётся для устранения badge pop-in при гидрации auth store.
export default async function FeedPage() {
  const { feedPage: initialData, currentUserId, currentUserRole } = await fetchInitialPostsServer()
  return <FeedPageClient initialData={initialData} initialUserId={currentUserId} initialUserRole={currentUserRole} />
}
