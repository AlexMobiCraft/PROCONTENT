import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

    it('показывает "Не оплачена" для unpaid статуса', () => {
      render(<SubscriptionCard {...defaultProps} subscriptionStatus="unpaid" />)
      expect(screen.getByText('Не оплачена')).toBeInTheDocument()
    })

    it('показывает "Нет активной подписки" для null статуса', () => {
      render(<SubscriptionCard {...defaultProps} subscriptionStatus={null} />)
      expect(screen.getByText('Нет активной подписки')).toBeInTheDocument()
    })

    it('показывает "Приостановлена" для paused статуса', () => {
      render(<SubscriptionCard {...defaultProps} subscriptionStatus="paused" />)
      expect(screen.getByText('Приостановлена')).toBeInTheDocument()
    })

    it('показывает "Не завершена" для incomplete статуса', () => {
      render(<SubscriptionCard {...defaultProps} subscriptionStatus="incomplete" />)
      expect(screen.getByText('Не завершена')).toBeInTheDocument()
    })

    it('показывает "Не завершена" для incomplete_expired статуса', () => {
      render(<SubscriptionCard {...defaultProps} subscriptionStatus="incomplete_expired" />)
      expect(screen.getByText('Не завершена')).toBeInTheDocument()
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
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('выполняет редирект на URL портала при успешном запросе', async () => {
      vi.stubGlobal('location', { href: '', origin: 'http://localhost:3000' })
      const user = userEvent.setup()
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://billing.stripe.com/portal/test' }),
      } as Response)

      render(<SubscriptionCard {...defaultProps} />)
      await user.click(screen.getByRole('button', { name: /Управление подпиской/ }))

      await waitFor(() => {
        expect(window.location.href).toBe('https://billing.stripe.com/portal/test')
      })
    })

    it('кнопка остаётся заблокированной после успешного редиректа (нет race condition)', async () => {
      vi.stubGlobal('location', { href: '', origin: 'http://localhost:3000' })
      const user = userEvent.setup()
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://billing.stripe.com/portal/test' }),
      } as Response)

      render(<SubscriptionCard {...defaultProps} />)
      await user.click(screen.getByRole('button', { name: /Управление подпиской/ }))

      await waitFor(() => {
        expect(window.location.href).toBe('https://billing.stripe.com/portal/test')
      })
      // isLoading НЕ сбрасывается после редиректа — кнопка остаётся заблокированной до навигации
      expect(screen.getByRole('button', { name: /Загрузка/ })).toBeDisabled()
    })

    it('отправляет POST на /api/stripe/portal с returnUrl клиента', async () => {
      vi.stubGlobal('location', { href: 'http://localhost:3000/profile', origin: 'http://localhost:3000' })
      const user = userEvent.setup()
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://billing.stripe.com/portal/test' }),
      } as Response)

      render(<SubscriptionCard {...defaultProps} />)
      await user.click(screen.getByRole('button', { name: /Управление подпиской/ }))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/stripe/portal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ returnUrl: 'http://localhost:3000/profile' }),
        })
      })
    })

    it('показывает generic-ошибку при неуспешном ответе сервера (скрывает data.error)', async () => {
      const user = userEvent.setup()
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Аккаунт Stripe не найден' }),
      } as Response)

      render(<SubscriptionCard {...defaultProps} />)
      await user.click(screen.getByRole('button', { name: /Управление подпиской/ }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Не удалось открыть портал управления подпиской'
        )
        // убеждаемся что raw API error не выведен напрямую
        expect(screen.getByRole('alert')).not.toHaveTextContent('Аккаунт Stripe не найден')
      })
    })

    it('показывает сообщение из ответа при ошибке 429 Rate Limit', async () => {
      const user = userEvent.setup()
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Слишком много запросов. Попробуйте позже.' }),
      } as Response)

      render(<SubscriptionCard {...defaultProps} />)
      await user.click(screen.getByRole('button', { name: /Управление подпиской/ }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Слишком много запросов. Попробуйте позже.'
        )
      })
    })

    it('показывает generic-ошибку даже если в ответе нет поля error', async () => {
      const user = userEvent.setup()
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response)

      render(<SubscriptionCard {...defaultProps} />)
      await user.click(screen.getByRole('button', { name: /Управление подпиской/ }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Не удалось открыть портал управления подпиской'
        )
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

    it('логирует ошибку в console.error при сетевом сбое', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const user = userEvent.setup()
      const networkError = new Error('Network error')
      vi.mocked(global.fetch).mockRejectedValueOnce(networkError)

      render(<SubscriptionCard {...defaultProps} />)
      await user.click(screen.getByRole('button', { name: /Управление подпиской/ }))

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('/api/stripe/portal'),
          networkError
        )
      })
      consoleSpy.mockRestore()
    })

    it('сбрасывает isLoading при восстановлении страницы из BFCache (pageshow persisted)', async () => {
      vi.stubGlobal('location', { href: '', origin: 'http://localhost:3000' })
      const user = userEvent.setup()
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://billing.stripe.com/portal/test' }),
      } as Response)

      render(<SubscriptionCard {...defaultProps} />)
      await user.click(screen.getByRole('button', { name: /Управление подпиской/ }))

      // После успешного редиректа isLoading остаётся true — кнопка заблокирована
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Загрузка/ })).toBeDisabled()
      })

      // Симулируем восстановление страницы из BFCache (event.persisted = true)
      const pageshowEvent = new PageTransitionEvent('pageshow', { persisted: true })
      act(() => {
        window.dispatchEvent(pageshowEvent)
      })

      // isLoading должен сброситься — кнопка снова активна
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Управление подпиской/ })).not.toBeDisabled()
      })
    })

    it('НЕ сбрасывает isLoading при обычном pageshow (persisted=false)', async () => {
      vi.stubGlobal('location', { href: '', origin: 'http://localhost:3000' })
      const user = userEvent.setup()
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://billing.stripe.com/portal/test' }),
      } as Response)

      render(<SubscriptionCard {...defaultProps} />)
      await user.click(screen.getByRole('button', { name: /Управление подпиской/ }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Загрузка/ })).toBeDisabled()
      })

      // Обычный pageshow (не BFCache) — не сбрасываем isLoading
      const pageshowEvent = new PageTransitionEvent('pageshow', { persisted: false })
      act(() => {
        window.dispatchEvent(pageshowEvent)
      })

      expect(screen.getByRole('button', { name: /Загрузка/ })).toBeDisabled()
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
