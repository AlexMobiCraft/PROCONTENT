import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRedirect = vi.hoisted(() => vi.fn())
const mockGetUser = vi.hoisted(() => vi.fn())
const mockSingle = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockSingle,
    })),
  })),
}))

// ProfileScreen рендерится как клиентский компонент — мокируем для изоляции Server Component
vi.mock('@/features/profile/components/ProfileScreen', () => ({
  ProfileScreen: (props: Record<string, unknown>) => (
    <div data-testid="profile-screen" data-props={JSON.stringify(props)} />
  ),
}))

import ProfilePage from '@/app/(app)/profile/page'
import { render, screen } from '@testing-library/react'

const mockProfile = {
  email: 'test@example.com',
  display_name: 'Тест Пользователь',
  subscription_status: 'active',
  current_period_end: '2026-04-15T00:00:00.000Z',
  stripe_customer_id: 'cus_test123',
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123', email: 'test@example.com' } } })
    mockSingle.mockResolvedValue({ data: mockProfile, error: null })
  })

  it('рендерит ProfileScreen с данными профиля', async () => {
    const page = await ProfilePage()
    render(page)

    const el = screen.getByTestId('profile-screen')
    expect(el).toBeInTheDocument()

    const props = JSON.parse(el.getAttribute('data-props') ?? '{}')
    expect(props.email).toBe('test@example.com')
    expect(props.displayName).toBe('Тест Пользователь')
    expect(props.subscriptionStatus).toBe('active')
    expect(props.hasStripeCustomer).toBe(true)
  })

  it('передаёт email из auth.user если в profiles нет email', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { ...mockProfile, email: null },
      error: null,
    })

    const page = await ProfilePage()
    render(page)

    const props = JSON.parse(
      screen.getByTestId('profile-screen').getAttribute('data-props') ?? '{}'
    )
    expect(props.email).toBe('test@example.com')
  })

  it('передаёт hasStripeCustomer=false если stripe_customer_id отсутствует', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { ...mockProfile, stripe_customer_id: null },
      error: null,
    })

    const page = await ProfilePage()
    render(page)

    const props = JSON.parse(
      screen.getByTestId('profile-screen').getAttribute('data-props') ?? '{}'
    )
    expect(props.hasStripeCustomer).toBe(false)
  })

  it('редиректит на /login если пользователь не авторизован', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    mockRedirect.mockImplementation(() => {
      throw new Error('REDIRECT')
    })

    await expect(ProfilePage()).rejects.toThrow('REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('показывает ProfileScreen с email из auth при PGRST116 (профиль не создан)', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'no rows returned' },
    })

    const page = await ProfilePage()
    render(page)

    const el = screen.getByTestId('profile-screen')
    expect(el).toBeInTheDocument()
    const props = JSON.parse(el.getAttribute('data-props') ?? '{}')
    expect(props.email).toBe('test@example.com') // из auth.user
    expect(props.hasStripeCustomer).toBe(false)
    expect(props.subscriptionStatus).toBeNull()
    expect(props.displayName).toBeNull()
  })

  it('показывает ошибку с заголовком Профиль если profileError существует', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'DB connection error' },
    })

    const page = await ProfilePage()
    render(page)

    expect(screen.queryByTestId('profile-screen')).not.toBeInTheDocument()
    // Заголовок остаётся, интерфейс не выглядит "сломанным"
    expect(screen.getByRole('heading', { name: 'Профиль' })).toBeInTheDocument()
    expect(
      screen.getByText(/Не удалось загрузить данные профиля/)
    ).toBeInTheDocument()
  })
})
