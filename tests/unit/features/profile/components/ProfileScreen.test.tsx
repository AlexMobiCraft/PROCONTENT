import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

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

// Мокаем EmailPreferencesCard для изоляции ProfileScreen
vi.mock('@/features/profile/components/EmailPreferencesCard', () => ({
  EmailPreferencesCard: ({
    emailNotificationsEnabled,
    onToggle,
    isLoading,
  }: {
    emailNotificationsEnabled: boolean
    onToggle: (v: boolean) => void
    isLoading?: boolean
  }) => (
    <div data-testid="email-preferences-card">
      <div
        role="switch"
        data-testid="email-toggle"
        aria-checked={emailNotificationsEnabled}
        onClick={() => onToggle(!emailNotificationsEnabled)}
        aria-disabled={isLoading}
      />
    </div>
  ),
}))

const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockFrom = vi.fn()
const mockSupabaseClient = { from: mockFrom }

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}))

const mockToastError = vi.fn()
const mockToastSuccess = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    error: (msg: string) => mockToastError(msg),
    success: (msg: string) => mockToastSuccess(msg),
  },
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
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
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({ update: mockUpdate })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ error: null })
  })

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
    expect(screen.getByText('user@example.com')).toBeInTheDocument()
  })

  it('отображает SubscriptionCard', () => {
    render(<ProfileScreen {...defaultProps} />)
    expect(screen.getByTestId('subscription-card')).toBeInTheDocument()
  })

  it('не показывает EmailPreferencesCard когда canManageEmailPreferences=false', () => {
    render(
      <ProfileScreen
        {...defaultProps}
        canManageEmailPreferences={false}
      />
    )
    expect(screen.queryByTestId('email-preferences-card')).not.toBeInTheDocument()
  })

  it('не показывает EmailPreferencesCard по умолчанию (PGRST116 сценарий)', () => {
    render(<ProfileScreen {...defaultProps} />)
    expect(screen.queryByTestId('email-preferences-card')).not.toBeInTheDocument()
  })

  it('показывает EmailPreferencesCard когда canManageEmailPreferences=true', () => {
    render(
      <ProfileScreen
        {...defaultProps}
        userId="user-id-123"
        emailNotificationsEnabled={true}
        canManageEmailPreferences={true}
      />
    )
    expect(screen.getByTestId('email-preferences-card')).toBeInTheDocument()
  })

  it('успешный toggle — вызывает Supabase update и показывает success toast', async () => {
    render(
      <ProfileScreen
        {...defaultProps}
        userId="user-id-123"
        emailNotificationsEnabled={true}
        canManageEmailPreferences={true}
      />
    )

    fireEvent.click(screen.getByTestId('email-toggle'))

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('profiles')
      expect(mockUpdate).toHaveBeenCalledWith({ email_notifications_enabled: false })
      expect(mockEq).toHaveBeenCalledWith('id', 'user-id-123')
    })

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('E-poštna obvestila so izklopljena')
    })
  })

  it('успешный toggle включения — показывает правильный toast', async () => {
    render(
      <ProfileScreen
        {...defaultProps}
        userId="user-id-123"
        emailNotificationsEnabled={false}
        canManageEmailPreferences={true}
      />
    )

    fireEvent.click(screen.getByTestId('email-toggle'))

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('E-poštna obvestila so vklopljena')
    })
  })

  it('ошибка toggle — показывает error toast и rollback состояния', async () => {
    mockEq.mockResolvedValue({ error: { message: 'DB error' } })

    render(
      <ProfileScreen
        {...defaultProps}
        userId="user-id-123"
        emailNotificationsEnabled={true}
        canManageEmailPreferences={true}
      />
    )

    const toggle = screen.getByTestId('email-toggle')
    fireEvent.click(toggle)

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Napaka pri shranjevanju nastavitev')
    })

    // Rollback: aria-checked должен вернуться к исходному значению true
    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-checked', 'true')
    })
  })

  it('не показывает admin-секцию без isAdmin', () => {
    render(<ProfileScreen {...defaultProps} />)
    expect(screen.queryByRole('region', { name: 'Administracija' })).not.toBeInTheDocument()
    expect(screen.queryByText('Nova objava')).not.toBeInTheDocument()
  })

  it('не показывает admin-секцию при isAdmin=false', () => {
    render(<ProfileScreen {...defaultProps} isAdmin={false} />)
    expect(screen.queryByText('Nova objava')).not.toBeInTheDocument()
    expect(screen.queryByText('Kategorije')).not.toBeInTheDocument()
  })

  it('показывает admin-секцию при isAdmin=true', () => {
    render(<ProfileScreen {...defaultProps} isAdmin={true} />)
    expect(screen.getByText('Administracija')).toBeInTheDocument()
  })

  it('?????????? 4 admin-??????', () => {
    render(<ProfileScreen {...defaultProps} isAdmin={true} />)
    expect(screen.getByText('Nova objava')).toBeInTheDocument()
    expect(screen.getByText('Kategorije')).toBeInTheDocument()
    expect(screen.getByText(/Udele.*enke/i)).toBeInTheDocument()
    expect(screen.getByText('Nastavitve')).toBeInTheDocument()
  })

  it('admin-ссылки ведут на правильные пути', () => {
    render(<ProfileScreen {...defaultProps} isAdmin={true} />)
    expect(screen.getByRole('link', { name: 'Nova objava' })).toHaveAttribute('href', '/posts/create')
    expect(screen.getByRole('link', { name: 'Kategorije' })).toHaveAttribute('href', '/categories')
    expect(screen.getByRole('link', { name: /Udele.*enke/i })).toHaveAttribute('href', '/members')
    expect(screen.getByRole('link', { name: 'Nastavitve administracije' })).toHaveAttribute('href', '/settings')
  })

  it('не вызывает Supabase если userId не передан', async () => {
    render(
      <ProfileScreen
        {...defaultProps}
        emailNotificationsEnabled={true}
        canManageEmailPreferences={true}
      />
    )

    fireEvent.click(screen.getByTestId('email-toggle'))

    await waitFor(() => {
      expect(mockFrom).not.toHaveBeenCalled()
    })
  })
})
