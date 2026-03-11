'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { startCheckout } from '../api/checkout'
import { PricingSection } from './PricingSection'

export function PricingCheckoutWrapper() {
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false)

  async function handleCheckout(plan: 'monthly' | 'quarterly') {
    setIsCheckoutLoading(true)

    try {
      const url = await startCheckout(plan)
      window.location.href = url
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Не удалось начать оформление. Попробуйте снова.'
      )
      setIsCheckoutLoading(false)
    }
  }

  return <PricingSection onCheckout={handleCheckout} isLoading={isCheckoutLoading} />
}
