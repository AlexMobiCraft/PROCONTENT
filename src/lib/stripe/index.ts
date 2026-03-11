import Stripe from 'stripe'

const secretKey = process.env.STRIPE_SECRET_KEY
if (!secretKey) {
  throw new Error('[stripe] STRIPE_SECRET_KEY is not configured')
}

export const stripe = new Stripe(secretKey, {
  apiVersion: '2026-02-25.clover',
  typescript: true,
})
