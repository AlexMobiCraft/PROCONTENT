import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/features/search/components/SearchContainer', () => ({
  SearchContainer: ({ initialQuery }: { initialQuery: string }) => (
    <div data-testid="search-container" data-query={initialQuery} />
  ),
}))

import SearchPage from '@/app/(app)/search/page'

describe('SearchPage', () => {
  it('рендерит SearchContainer без initialQuery когда ?q отсутствует', async () => {
    const page = await SearchPage({ searchParams: Promise.resolve({}) })
    render(page)
    const container = screen.getByTestId('search-container')
    expect(container).toBeInTheDocument()
    expect(container.getAttribute('data-query')).toBe('')
  })

  it('передаёт q из searchParams как initialQuery', async () => {
    const page = await SearchPage({ searchParams: Promise.resolve({ q: 'test-query' }) })
    render(page)
    const container = screen.getByTestId('search-container')
    expect(container.getAttribute('data-query')).toBe('test-query')
  })
})
