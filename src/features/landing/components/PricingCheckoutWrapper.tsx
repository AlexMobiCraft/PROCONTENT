'use client'

import { useState } from 'react'
import { PricingSection } from './PricingSection'
import { startCheckout } from '../api/checkout'

export function PricingCheckoutWrapper() {
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  async function handleCheckout(plan: 'monthly' | 'quarterly') {
    setIsCheckoutLoading(true)
    setCheckoutError(null)

    try {
      const url = await startCheckout(plan)
      window.location.href = url
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : 'Не удалось начать оформление. Попробуйте снова.'
      )
      setIsCheckoutLoading(false)
    }
  }

  return (
    <PricingSection
      onCheckout={handleCheckout}
      isLoading={isCheckoutLoading}
      errorMessage={checkoutError}
    />
  )
}
