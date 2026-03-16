'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// periodEndDisplay — уже отформатированная на клиенте строка (или null)
function getStatusLabel(
  status: string | null,
  periodEndDisplay: string | null
): { label: string; active: boolean } {
  if (status === 'active' || status === 'trialing') {
    return {
      label: periodEndDisplay ? `Активна до ${periodEndDisplay}` : 'Активна',
      active: true,
    }
  }
  if (status === 'canceled') return { label: 'Отменена', active: false }
  if (status === 'past_due') return { label: 'Требует оплаты', active: false }
  if (status === 'unpaid') return { label: 'Не оплачена', active: false }
  return { label: 'Нет активной подписки', active: false }
}

interface SubscriptionCardProps {
  subscriptionStatus: string | null
  currentPeriodEnd: string | null
  hasStripeCustomer: boolean
}

export function SubscriptionCard({
  subscriptionStatus,
  currentPeriodEnd,
  hasStripeCustomer,
}: SubscriptionCardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Форматирование в useEffect предотвращает hydration mismatch:
  // сервер рендерит с UTC, клиент — с локальной таймзоной.
  const [periodEndDisplay, setPeriodEndDisplay] = useState<string | null>(null)

  useEffect(() => {
    if (!currentPeriodEnd) {
      setPeriodEndDisplay(null)
      return
    }
    const date = new Date(currentPeriodEnd)
    if (isNaN(date.getTime())) {
      setPeriodEndDisplay(currentPeriodEnd)
      return
    }
    setPeriodEndDisplay(
      date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })
    )
  }, [currentPeriodEnd])

  async function handleManageSubscription() {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = (await response.json()) as { url?: string; error?: string }

      if (!response.ok || !data.url) {
        setError('Не удалось открыть портал управления подпиской')
        return
      }

      window.location.href = data.url
    } catch {
      setError('Ошибка соединения')
    } finally {
      setIsLoading(false)
    }
  }

  const { label, active } = getStatusLabel(subscriptionStatus, periodEndDisplay)

  return (
    <div className="space-y-4 border border-border p-6">
      <div>
        <p className="mb-1 text-xs uppercase tracking-[0.15em] text-muted-foreground">Подписка</p>
        <p className={cn('font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>
          {label}
        </p>
      </div>

      {hasStripeCustomer && (
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManageSubscription}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? 'Загрузка…' : 'Управление подпиской'}
          </Button>
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
