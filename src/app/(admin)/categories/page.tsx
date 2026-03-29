import { getCategoriesServer } from '@/features/admin/api/categoriesServer'
import { CategoryManager } from '@/features/admin/components/CategoryManager'

export const metadata = { title: 'Upravljanje kategorij' }

export default async function CategoriesPage() {
  const categories = await getCategoriesServer()

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 font-heading text-2xl font-semibold">Kategorije</h1>
      <CategoryManager initialCategories={categories} />
    </main>
  )
}
