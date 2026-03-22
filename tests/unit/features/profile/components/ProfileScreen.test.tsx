import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// SubscriptionCard использует useEffect и window — мокаем для изоляции
vi.mock('@/features/profile/components/SubscriptionCard', () => ({
  SubscriptionCard: ({ subscriptionStatus }: { subscriptionStatus: string | null }) => (
    <div data-testid="subscription-card">{subscriptionStatus}</div>
  ),
}))

// ProfileRightPanel рендерится дважды (mobile + desktop) — мокаем для изоляции основной колонки
vi.mock('@/features/profile/components/ProfileRightPanel', () => ({
  ProfileRightPanel: () => <div data-testid="profile-right-panel" />,
}))

import { ProfileScreen } from '@/features/profile/components/ProfileScreen'

const defaultProps = {
  email: 'user@example.com',
  displayName: 'Иван Иванов',
  subscriptionStatus: 'active',
  currentPeriodEnd: '2026-04-15T00:00:00.000Z',
  hasStripeCustomer: true,
}

describe('ProfileScreen', () => {
  it('отображает заголовок "Profil"', () => {
    render(<ProfileScreen {...defaultProps} />)
    expect(screen.getByRole('heading', { name: 'Profil' })).toBeInTheDocument()
  })

  it('отображает email пользователя', () => {
    render(<ProfileScreen {...defaultProps} />)
    expect(screen.getByText('user@example.com')).toBeInTheDocument()
  })

  it('отображает displayName если передан', () => {
    render(<ProfileScreen {...defaultProps} />)
    expect(screen.getByText('Иван Иванов')).toBeInTheDocument()
  })

  it('не отображает displayName если он null', () => {
    render(<ProfileScreen {...defaultProps} displayName={null} />)
    expect(screen.queryByText('Иван Иванов')).not.toBeInTheDocument()
    // email по-прежнему виден
    expect(screen.getByText('user@example.com')).toBeInTheDocument()
  })

  it('отображает SubscriptionCard', () => {
    render(<ProfileScreen {...defaultProps} />)
    expect(screen.getByTestId('subscription-card')).toBeInTheDocument()
  })
})
