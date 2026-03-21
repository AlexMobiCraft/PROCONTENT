import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PricingSection } from '@/features/landing/components/PricingSection'

describe('PricingSection — checkout behaviour', () => {
  it('кнопка переходит в disabled при isLoading=true', () => {
    render(<PricingSection onCheckout={vi.fn()} isLoading={true} />)

    const button = screen.getByRole('button', { name: /Nalaganje.../i })
    expect(button).toBeDisabled()
  })

  it('кнопка активна при isLoading=false', () => {
    render(<PricingSection onCheckout={vi.fn()} isLoading={false} />)

    const button = screen.getByRole('button', { name: /Pridruži se zdaj/i })
    expect(button).not.toBeDisabled()
  })

  it('вызывает onCheckout при клике на кнопку', async () => {
    const user = userEvent.setup()
    const mockCheckout = vi.fn()

    render(<PricingSection onCheckout={mockCheckout} isLoading={false} />)

    const button = screen.getByRole('button', { name: /Pridruži se zdaj/i })
    await user.click(button)

    expect(mockCheckout).toHaveBeenCalledOnce()
    expect(mockCheckout).toHaveBeenCalledWith(expect.stringMatching(/^(monthly|quarterly)$/))
  })

  it('кнопка имеет атрибут disabled во время загрузки', () => {
    render(<PricingSection onCheckout={vi.fn()} isLoading={true} />)

    const button = screen.getByRole('button', { name: /Nalaganje.../i })
    expect(button).toHaveAttribute('disabled')
  })

  it('кнопка сохраняет min-h-[48px] в disabled-состоянии', () => {
    render(<PricingSection onCheckout={vi.fn()} isLoading={true} />)

    const button = screen.getByRole('button', { name: /Nalaganje.../i })
    expect(button.className).toContain('min-h-[48px]')
  })
})
