import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockToastError = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({
  toast: { error: mockToastError },
  Toaster: () => null,
}))

vi.mock('@/features/landing/api/checkout', () => ({
  startCheckout: vi.fn(),
}))

import { startCheckout } from '@/features/landing/api/checkout'
import { PricingCheckoutWrapper } from '@/features/landing/components/PricingCheckoutWrapper'

const mockStartCheckout = vi.mocked(startCheckout)

describe('PricingCheckoutWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('location', { href: '' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('кнопка переходит в disabled во время загрузки', async () => {
    const user = userEvent.setup()
    let resolveCheckout!: (url: string) => void
    mockStartCheckout.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveCheckout = resolve
      })
    )

    render(<PricingCheckoutWrapper />)

    const button = screen.getByRole('button', { name: /Вступить сейчас/i })
    await user.click(button)

    expect(screen.getByRole('button', { name: /Загрузка/i })).toBeDisabled()

    resolveCheckout('https://checkout.stripe.com/test')
  })

  it('успешный ответ — устанавливает window.location.href', async () => {
    const user = userEvent.setup()
    mockStartCheckout.mockResolvedValueOnce('https://checkout.stripe.com/test-session')

    render(<PricingCheckoutWrapper />)

    await user.click(screen.getByRole('button', { name: /Вступить сейчас/i }))

    await waitFor(() => {
      expect(window.location.href).toBe('https://checkout.stripe.com/test-session')
    })
  })

  it('ошибка — вызывает toast.error с сообщением', async () => {
    const user = userEvent.setup()
    mockStartCheckout.mockRejectedValueOnce(
      new Error('Не удалось начать оформление. Попробуйте снова.')
    )

    render(<PricingCheckoutWrapper />)

    await user.click(screen.getByRole('button', { name: /Вступить сейчас/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Не удалось начать оформление. Попробуйте снова.'
      )
    })
  })

  it('кнопка разблокируется после ошибки', async () => {
    const user = userEvent.setup()
    mockStartCheckout.mockRejectedValueOnce(new Error('Ошибка'))

    render(<PricingCheckoutWrapper />)

    await user.click(screen.getByRole('button', { name: /Вступить сейчас/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Вступить сейчас/i })).not.toBeDisabled()
    })
  })

  it('ошибка без message — показывает fallback toast', async () => {
    const user = userEvent.setup()
    mockStartCheckout.mockRejectedValueOnce('network failure')

    render(<PricingCheckoutWrapper />)

    await user.click(screen.getByRole('button', { name: /Вступить сейчас/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Не удалось начать оформление. Попробуйте снова.'
      )
    })
  })
})
