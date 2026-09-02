'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { startCheckout, type CheckoutPlan } from '../api/checkout'
import { PricingSection } from './PricingSection'

interface PricingCheckoutWrapperProps {
  /**
   * Promo-режим выводится на сервере (см. src/app/page.tsx) — клиент его включить не может.
   * Проп обязателен: забытый проброс должен быть ошибкой типов, а не тихим откатом к €34,00.
   */
  isPromoActive: boolean
}

export function PricingCheckoutWrapper({ isPromoActive }: PricingCheckoutWrapperProps) {
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false)

  async function handleCheckout(plan: CheckoutPlan) {
    setIsCheckoutLoading(true)

    try {
      const url = await startCheckout(plan)
      window.location.href = url
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Naročnine ni bilo mogoče začeti. Poskusite znova.'
      )
      setIsCheckoutLoading(false)
    }
  }

  return (
    <PricingSection
      onCheckout={handleCheckout}
      isLoading={isCheckoutLoading}
      isPromoActive={isPromoActive}
    />
  )
}
