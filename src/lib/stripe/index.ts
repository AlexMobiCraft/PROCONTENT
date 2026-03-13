import Stripe from 'stripe'

const secretKey = process.env.STRIPE_SECRET_KEY

// Не выбрасываем ошибку на этапе сборки (build time), так как секретные ключи 
// обычно отсутствуют в среде CI. Проверка будет выполнена при фактическом использовании.
if (!secretKey && process.env.NODE_ENV === 'production') {
  console.warn('[stripe] STRIPE_SECRET_KEY is not configured. This is expected during build time if the key is a secret.')
}

export const stripe = new Stripe(secretKey || 'sk_test_placeholder', {
  apiVersion: '2026-02-25.clover',
})
