import { PostForm } from '@/features/admin/components/PostForm'

export const metadata = { title: 'Nova objava' }

export default function CreatePostPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 font-heading text-2xl font-semibold">Nova objava</h1>
      <PostForm mode="create" />
    </main>
  )
}
