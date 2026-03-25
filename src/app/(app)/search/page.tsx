import { Suspense } from 'react'
import { SearchContainer } from '@/features/search/components/SearchContainer'
import SearchLoading from './loading'

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams
  return (
    <Suspense fallback={<SearchLoading />}>
      <SearchContainer initialQuery={q ?? ''} />
    </Suspense>
  )
}
