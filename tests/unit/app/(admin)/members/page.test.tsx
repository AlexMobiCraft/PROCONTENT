import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/features/admin/api/membersServer', () => ({
  fetchMembersServer: vi.fn().mockResolvedValue([
    {
      id: 'u1',
      email: 'ana@example.com',
      display_name: 'Ana',
      created_at: '2026-01-01T00:00:00Z',
      subscription_status: 'active',
      current_period_end: null,
      stripe_customer_id: null,
    },
  ]),
}))

vi.mock('@/features/admin/components/MembersContainer', () => ({
  MembersContainer: ({ initialMembers }: { initialMembers: unknown[] }) => (
    <div data-testid="members-container" data-count={initialMembers.length} />
  ),
}))

import MembersPage from '@/app/(admin)/members/page'

describe('MembersPage', () => {
  it('рендерит заголовок страницы', async () => {
    render(await MembersPage())
    expect(screen.getByRole('heading', { name: 'Udeleženke' })).toBeInTheDocument()
  })

  it('рендерит MembersContainer с данными', async () => {
    render(await MembersPage())
    const container = screen.getByTestId('members-container')
    expect(container).toBeInTheDocument()
    expect(container).toHaveAttribute('data-count', '1')
  })
})
