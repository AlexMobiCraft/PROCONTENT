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

    render(<PricingCheckoutWrapper isPromoActive={false} />)

    const button = screen.getByRole('button', { name: /Pridruži se zdaj/i })
    await user.click(button)

    expect(screen.getByRole('button', { name: /Nalaganje.../i })).toBeDisabled()

    resolveCheckout('https://checkout.stripe.com/test')
  })

  it('успешный ответ — устанавливает window.location.href', async () => {
    const user = userEvent.setup()
    mockStartCheckout.mockResolvedValueOnce('https://checkout.stripe.com/test-session')

    render(<PricingCheckoutWrapper isPromoActive={false} />)

    await user.click(screen.getByRole('button', { name: /Pridruži se zdaj/i }))

    await waitFor(() => {
      expect(window.location.href).toBe('https://checkout.stripe.com/test-session')
    })
  })

  it('ошибка — вызывает toast.error с сообщением', async () => {
    const user = userEvent.setup()
    mockStartCheckout.mockRejectedValueOnce(
      new Error('Naročnine ni bilo mogoče začeti. Poskusite znova.')
    )

    render(<PricingCheckoutWrapper isPromoActive={false} />)

    await user.click(screen.getByRole('button', { name: /Pridruži se zdaj/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Naročnine ni bilo mogoče začeti. Poskusite znova.'
      )
    })
  })

  it('кнопка разблокируется после ошибки', async () => {
    const user = userEvent.setup()
    mockStartCheckout.mockRejectedValueOnce(new Error('Ошибка'))

    render(<PricingCheckoutWrapper isPromoActive={false} />)

    await user.click(screen.getByRole('button', { name: /Pridruži se zdaj/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Pridruži se zdaj/i })).not.toBeDisabled()
    })
  })

  it('ошибка без message — показывает fallback toast', async () => {
    const user = userEvent.setup()
    mockStartCheckout.mockRejectedValueOnce('network failure')

    render(<PricingCheckoutWrapper isPromoActive={false} />)

    await user.click(screen.getByRole('button', { name: /Pridruži se zdaj/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Naročnine ni bilo mogoče začeti. Poskusite znova.'
      )
    })
  })

  // Проводка isPromoActive до самого вызова API: без этого тесты остаются
  // зелёными, даже если проброс пропа оборвётся, а лендинг молча вернётся к €34,00
  it('при isPromoActive рендерит акцию и запрашивает checkout с планом promo', async () => {
    const user = userEvent.setup()
    mockStartCheckout.mockResolvedValueOnce('https://checkout.stripe.com/promo')

    render(<PricingCheckoutWrapper isPromoActive />)

    expect(screen.getByText('€29,00')).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Pridruži se zdaj/i }))

    await waitFor(() => {
      expect(mockStartCheckout).toHaveBeenCalledWith('promo')
    })
  })

  it('без isPromoActive запрашивает checkout по обычному тарифу', async () => {
    const user = userEvent.setup()
    mockStartCheckout.mockResolvedValueOnce('https://checkout.stripe.com/quarterly')

    render(<PricingCheckoutWrapper isPromoActive={false} />)

    await user.click(screen.getByRole('button', { name: /Pridruži se zdaj/i }))

    await waitFor(() => {
      expect(mockStartCheckout).toHaveBeenCalledWith(
        expect.stringMatching(/^(monthly|quarterly)$/)
      )
    })
  })
})
