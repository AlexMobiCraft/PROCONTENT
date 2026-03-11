export async function startCheckout(plan: 'monthly' | 'quarterly'): Promise<string> {
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  })

  const data = (await response.json()) as { url?: string; error?: string }

  if (!response.ok) {
    throw new Error(data.error ?? 'Не удалось начать оформление. Попробуйте снова.')
  }

  return data.url!
}
