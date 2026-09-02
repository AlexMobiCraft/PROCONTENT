import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PricingSection } from '@/features/landing/components/PricingSection'

describe('PricingSection — checkout behaviour', () => {
  it('кнопка переходит в disabled при isLoading=true', () => {
    render(<PricingSection onCheckout={vi.fn()} isLoading={true} isPromoActive={false} />)

    const button = screen.getByRole('button', { name: /Nalaganje.../i })
    expect(button).toBeDisabled()
  })

  it('кнопка активна при isLoading=false', () => {
    render(<PricingSection onCheckout={vi.fn()} isLoading={false} isPromoActive={false} />)

    const button = screen.getByRole('button', { name: /Pridruži se zdaj/i })
    expect(button).not.toBeDisabled()
  })

  it('вызывает onCheckout при клике на кнопку', async () => {
    const user = userEvent.setup()
    const mockCheckout = vi.fn()

    render(<PricingSection onCheckout={mockCheckout} isLoading={false} isPromoActive={false} />)

    const button = screen.getByRole('button', { name: /Pridruži se zdaj/i })
    await user.click(button)

    expect(mockCheckout).toHaveBeenCalledOnce()
    expect(mockCheckout).toHaveBeenCalledWith(expect.stringMatching(/^(monthly|quarterly)$/))
  })

  it('кнопка имеет атрибут disabled во время загрузки', () => {
    render(<PricingSection onCheckout={vi.fn()} isLoading={true} isPromoActive={false} />)

    const button = screen.getByRole('button', { name: /Nalaganje.../i })
    expect(button).toHaveAttribute('disabled')
  })

  it('кнопка сохраняет min-h-[48px] в disabled-состоянии', () => {
    render(<PricingSection onCheckout={vi.fn()} isLoading={true} isPromoActive={false} />)

    const button = screen.getByRole('button', { name: /Nalaganje.../i })
    expect(button.className).toContain('min-h-[48px]')
  })
})

describe('PricingSection — временное предложение €29 / 3 мес', () => {
  it('без promo-режима показывает переключатель тарифов и обе цены', () => {
    render(<PricingSection onCheckout={vi.fn()} isLoading={false} isPromoActive={false} />)

    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    expect(screen.getByText('€12,99')).toBeInTheDocument()
    // Крупная цена выбранного тарифа + карточка «3 mesece» в переключателе
    expect(screen.getAllByText('€34,00')).toHaveLength(2)
    expect(screen.queryByText('€29,00')).not.toBeInTheDocument()
  })

  it('в promo-режиме убирает переключатель, месячный тариф и расчёт выгоды', () => {
    render(<PricingSection onCheckout={vi.fn()} isLoading={false} isPromoActive />)

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(screen.queryByText('€12,99')).not.toBeInTheDocument()
    expect(screen.queryByText(/Mesečno/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Prihranek/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/≈/)).not.toBeInTheDocument()
  })

  it('в promo-режиме показывает €29,00 за 3 месяца и семантически зачёркнутую €34,00', () => {
    const { container } = render(
      <PricingSection onCheckout={vi.fn()} isLoading={false} isPromoActive />
    )

    expect(screen.getByText('€29,00')).toBeInTheDocument()
    expect(screen.getByText('/ 3 mesece')).toBeInTheDocument()

    // €34,00 встречается ровно один раз и только внутри <s> — старая цена
    // не должна остаться где-то ещё как действующая
    const oldPriceNodes = screen.getAllByText('€34,00')
    expect(oldPriceNodes).toHaveLength(1)
    expect(oldPriceNodes[0].tagName).toBe('S')
    expect(container.querySelectorAll('s')).toHaveLength(1)

    // Подпись рядом делает зачёркивание понятным и для скринридеров
    expect(screen.getByText('Namesto')).toBeInTheDocument()
  })

  it('в promo-режиме сообщает об отсутствии автопродления вместо отмены подписки', () => {
    render(<PricingSection onCheckout={vi.fn()} isLoading={false} isPromoActive />)

    expect(screen.queryByText(/Odpoved kadar koli/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Odpoved z 1 klikom/i)).not.toBeInTheDocument()
    expect(screen.getByText(/se ne podaljša samodejno/i)).toBeInTheDocument()
  })

  it('в promo-режиме CTA сохраняет имя и вызывает onCheckout с планом promo', async () => {
    const user = userEvent.setup()
    const mockCheckout = vi.fn()

    render(<PricingSection onCheckout={mockCheckout} isLoading={false} isPromoActive />)

    const button = screen.getByRole('button', { name: /Pridruži se zdaj/i })
    expect(button.className).toContain('min-h-[48px]')

    await user.click(button)

    expect(mockCheckout).toHaveBeenCalledOnce()
    expect(mockCheckout).toHaveBeenCalledWith('promo')
  })

  it('в promo-режиме сохраняет список преимуществ', () => {
    render(<PricingSection onCheckout={vi.fn()} isLoading={false} isPromoActive />)

    expect(screen.getByText(/Popoln dostop do baze znanja/i)).toBeInTheDocument()
    expect(screen.getByText(/Chat za udeleženke v WhatsApp/i)).toBeInTheDocument()
  })
})
