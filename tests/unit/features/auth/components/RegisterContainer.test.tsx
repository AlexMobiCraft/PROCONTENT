import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Цепочка: from('profiles').update({...}).eq('id', userId).select('id')
const { mockPush, mockSignUp, mockSelect, mockEq, mockUpdate, mockFrom } = vi.hoisted(() => {
  const mockSelect = vi.fn()
  const mockEq = vi.fn(() => ({ select: mockSelect }))
  const mockUpdate = vi.fn(() => ({ eq: mockEq }))
  const mockFrom = vi.fn(() => ({ update: mockUpdate }))
  return {
    mockPush: vi.fn(),
    mockSignUp: vi.fn(),
    mockSelect,
    mockEq,
    mockUpdate,
    mockFrom,
  }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/features/auth/api/auth', () => ({
  signUp: mockSignUp,
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mockFrom }),
}))

import { RegisterContainer } from '@/features/auth/components/RegisterContainer'

const CONFIRM_MESSAGE = /Potrditveno sporočilo je bilo poslano/

async function fillAndSubmit() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Ime'), 'Laura')
  await user.type(screen.getByLabelText('Priimek (izbirno)'), 'Maja')
  await user.type(screen.getByLabelText('Ustvarite geslo'), 'geslo123')
  await user.click(screen.getByRole('button', { name: /Dokončaj registracijo/i }))
}

describe('RegisterContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelect.mockResolvedValue({ data: [{ id: 'user-1' }], error: null })
  })

  // На боевом GoTrue включён autoconfirm — письма с подтверждением не будет никогда,
  // а сессия выдаётся сразу. Прежний безусловный текст «проверьте почту» оставлял
  // уже залогиненную участницу ждать несуществующее письмо.
  it('при выданной сессии сохраняет профиль и уводит в /onboarding', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: { access_token: 'token' } },
      error: null,
    })

    render(<RegisterContainer email="nova@example.com" />)
    await fillAndSubmit()

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/onboarding')
    })

    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(mockUpdate).toHaveBeenCalledWith({ first_name: 'Laura', last_name: 'Maja' })
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1')
    expect(screen.queryByText(CONFIRM_MESSAGE)).not.toBeInTheDocument()
  })

  it('без сессии показывает сообщение о письме и никуда не уводит', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: null },
      error: null,
    })

    render(<RegisterContainer email="nova@example.com" />)
    await fillAndSubmit()

    expect(await screen.findByText(CONFIRM_MESSAGE)).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('пустую фамилию сохраняет как null', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: { access_token: 'token' } },
      error: null,
    })

    const user = userEvent.setup()
    render(<RegisterContainer email="nova@example.com" />)
    await user.type(screen.getByLabelText('Ime'), 'Laura')
    await user.type(screen.getByLabelText('Ustvarite geslo'), 'geslo123')
    await user.click(screen.getByRole('button', { name: /Dokončaj registracijo/i }))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ first_name: 'Laura', last_name: null })
    })
  })

  it('при ошибке сохранения профиля показывает инлайн-ошибку без редиректа', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: { access_token: 'token' } },
      error: null,
    })
    mockSelect.mockResolvedValue({ data: null, error: { message: 'RLS denied' } })

    render(<RegisterContainer email="nova@example.com" />)
    await fillAndSubmit()

    expect(
      await screen.findByText(/Napaka pri shranjevanju podatkov profila/)
    ).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  // Ссылка из письма после оплаты долгоживущая — по ней можно прийти второй раз.
  // Supabase не раскрывает существование аккаунта: возвращает user с пустым identities.
  it('при повторном переходе по ссылке зовёт войти, а не ждать письмо', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'user-1', identities: [] }, session: null },
      error: null,
    })

    render(<RegisterContainer email="nova@example.com" />)
    await fillAndSubmit()

    expect(await screen.findByText(/Račun s tem e-naslovom že obstaja/)).toBeInTheDocument()
    expect(screen.queryByText(CONFIRM_MESSAGE)).not.toBeInTheDocument()
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  // Supabase на 0 затронутых строк (RLS / профиль ещё не создан триггером) не возвращает
  // ошибку — без проверки длины имя молча терялось бы, а участница видела бы успех.
  it('при нуле затронутых строк показывает ошибку, а не успех', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: { access_token: 'token' } },
      error: null,
    })
    mockSelect.mockResolvedValue({ data: [], error: null })

    render(<RegisterContainer email="nova@example.com" />)
    await fillAndSubmit()

    expect(
      await screen.findByText(/Napaka pri shranjevanju podatkov profila/)
    ).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('при ошибке signUp показывает её текст и не трогает профиль', async () => {
    mockSignUp.mockResolvedValue({
      data: null,
      error: { message: 'User already registered' },
    })

    render(<RegisterContainer email="nova@example.com" />)
    await fillAndSubmit()

    expect(await screen.findByText('User already registered')).toBeInTheDocument()
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('при ответе signUp без пользователя показывает общую ошибку', async () => {
    mockSignUp.mockResolvedValue({ data: { user: null, session: null }, error: null })

    render(<RegisterContainer email="nova@example.com" />)
    await fillAndSubmit()

    expect(await screen.findByText(/Napaka pri registraciji/)).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })
})
