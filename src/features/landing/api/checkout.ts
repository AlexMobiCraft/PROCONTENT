export async function startCheckout(plan: 'monthly' | 'quarterly'): Promise<string> {
  let response: Response
  try {
    response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
  } catch {
    throw new Error('Не удалось начать оформление. Попробуйте снова.')
  }

  let data: { url?: string; error?: string }
  try {
    data = (await response.json()) as { url?: string; error?: string }
  } catch {
    throw new Error('Не удалось начать оформление. Попробуйте снова.')
  }

  if (!response.ok) {
    throw new Error(data.error ?? 'Не удалось начать оформление. Попробуйте снова.')
  }

  if (!data.url) {
    throw new Error('Не удалось начать оформление. Попробуйте снова.')
  }

  return data.url
}
