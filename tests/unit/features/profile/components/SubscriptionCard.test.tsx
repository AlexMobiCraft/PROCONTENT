import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SubscriptionCard } from '@/features/profile/components/SubscriptionCard'

const defaultProps = {
  subscriptionStatus: 'active',
  currentPeriodEnd: '2026-04-15T00:00:00.000Z',
  hasStripeCustomer: true,
}

describe('SubscriptionCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  describe('отображение статуса', () => {
    it('показывает "Активна до [дата]" для active статуса с датой', () => {
      render(<SubscriptionCard {...defaultProps} />)
      expect(screen.getByText(/Активна до/)).toBeInTheDocument()
    })

    it('показывает "Активна" для active статуса без даты', () => {
      render(<SubscriptionCard {...defaultProps} currentPeriodEnd={null} />)
      expect(screen.getByText('Активна')).toBeInTheDocument()
    })

    it('показывает "Активна" для trialing статуса', () => {
      render(<SubscriptionCard {...defaultProps} subscriptionStatus="trialing" currentPeriodEnd={null} />)
      expect(screen.getByText('Активна')).toBeInTheDocument()
    })

    it('показывает "Отменена" для canceled статуса', () => {
      render(<SubscriptionCard {...defaultProps} subscriptionStatus="canceled" />)
      expect(screen.getByText('Отменена')).toBeInTheDocument()
    })

    it('показывает "Требует оплаты" для past_due статуса', () => {
      render(<SubscriptionCard {...defaultProps} subscriptionStatus="past_due" />)
      expect(screen.getByText('Требует оплаты')).toBeInTheDocument()
    })

    it('показывает "Нет активной подписки" для null статуса', () => {
      render(<SubscriptionCard {...defaultProps} subscriptionStatus={null} />)
      expect(screen.getByText('Нет активной подписки')).toBeInTheDocument()
    })

    it('не падает при невалидной дате, возвращает исходную строку', () => {
      render(<SubscriptionCard {...defaultProps} currentPeriodEnd="invalid-date" />)
      expect(screen.getByText(/invalid-date/)).toBeInTheDocument()
    })
  })

  describe('кнопка управления подпиской', () => {
    it('отображает кнопку если есть stripe customer', () => {
      render(<SubscriptionCard {...defaultProps} />)
      expect(screen.getByRole('button', { name: /Управление подпиской/ })).toBeInTheDocument()
    })

    it('скрывает кнопку если нет stripe customer', () => {
      render(<SubscriptionCard {...defaultProps} hasStripeCustomer={false} />)
      expect(screen.queryByRole('button', { name: /Управление подпиской/ })).not.toBeInTheDocument()
    })
  })

  describe('логика портала', () => {
    it('выполняет редирект на URL портала при успешном запросе', async () => {
      const user = userEvent.setup()
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://billing.stripe.com/portal/test' }),
      } as Response)

      const originalHref = window.location.href
      Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
        configurable: true,
      })

      render(<SubscriptionCard {...defaultProps} />)
      await user.click(screen.getByRole('button', { name: /Управление подпиской/ }))

      await waitFor(() => {
        expect(window.location.href).toBe('https://billing.stripe.com/portal/test')
      })

      Object.defineProperty(window, 'location', {
        value: { href: originalHref },
        writable: true,
        configurable: true,
      })
    })

    it('отправляет POST на /api/stripe/portal', async () => {
      const user = userEvent.setup()
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://billing.stripe.com/portal/test' }),
      } as Response)

      Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
        configurable: true,
      })

      render(<SubscriptionCard {...defaultProps} />)
      await user.click(screen.getByRole('button', { name: /Управление подпиской/ }))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/stripe/portal', { method: 'POST' })
      })
    })

    it('показывает ошибку из ответа сервера', async () => {
      const user = userEvent.setup()
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Аккаунт Stripe не найден' }),
      } as Response)

      render(<SubscriptionCard {...defaultProps} />)
      await user.click(screen.getByRole('button', { name: /Управление подпиской/ }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Аккаунт Stripe не найден')
      })
    })

    it('показывает дефолтную ошибку если в ответе нет поля error', async () => {
      const user = userEvent.setup()
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response)

      render(<SubscriptionCard {...defaultProps} />)
      await user.click(screen.getByRole('button', { name: /Управление подпиской/ }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Ошибка при открытии портала')
      })
    })

    it('показывает ошибку соединения при сетевом сбое', async () => {
      const user = userEvent.setup()
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

      render(<SubscriptionCard {...defaultProps} />)
      await user.click(screen.getByRole('button', { name: /Управление подпиской/ }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Ошибка соединения')
      })
    })

    it('блокирует кнопку во время загрузки', async () => {
      const user = userEvent.setup()
      vi.mocked(global.fetch).mockImplementation(() => new Promise(() => {}))

      render(<SubscriptionCard {...defaultProps} />)
      await user.click(screen.getByRole('button', { name: /Управление подпиской/ }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Загрузка/ })).toBeDisabled()
      })
    })
  })
})
