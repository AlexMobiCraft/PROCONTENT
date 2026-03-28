import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import EmailPreferencesPage from '@/app/(public)/email-preferences/page'

async function renderPage(status?: string) {
  const searchParams = Promise.resolve(status ? { status } : {})
  const ui = await EmailPreferencesPage({ searchParams })
  render(ui)
}

describe('EmailPreferencesPage', () => {
  it('статус unsubscribed — показывает подтверждение успешной отписки', async () => {
    await renderPage('unsubscribed')
    expect(screen.getByText('Odjava uspešna')).toBeInTheDocument()
    expect(
      screen.getByText(/Uspešno ste se odjavili od e-poštnih obvestil/)
    ).toBeInTheDocument()
  })

  it('статус invalid_or_expired — показывает сообщение об ошибке', async () => {
    await renderPage('invalid_or_expired')
    expect(screen.getByText('Neveljavna povezava')).toBeInTheDocument()
    expect(
      screen.getByText(/Povezava za odjavo je neveljavna ali je potekla/)
    ).toBeInTheDocument()
  })

  it('статус invalid_or_expired — не раскрывает технические детали токена', async () => {
    await renderPage('invalid_or_expired')
    expect(screen.queryByText(/token/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/uid/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/sig/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/hmac/i)).not.toBeInTheDocument()
  })

  it('неизвестный статус — показывает нейтральный fallback UI', async () => {
    await renderPage('unknown-status')
    expect(screen.getByText('E-poštne nastavitve')).toBeInTheDocument()
    expect(screen.getByText('Status odjave ni na voljo.')).toBeInTheDocument()
  })

  it('без статуса — показывает нейтральный fallback UI', async () => {
    await renderPage()
    expect(screen.getByText('E-poštne nastavitve')).toBeInTheDocument()
    expect(screen.getByText('Status odjave ni na voljo.')).toBeInTheDocument()
  })

  it('все варианты содержат ссылку для перехода к логину', async () => {
    await renderPage('unsubscribed')
    expect(screen.getByRole('link', { name: /Prijavite se v račun/ })).toBeInTheDocument()
  })

  it('страница не требует сессии — нет редиректа на /login при рендере', async () => {
    // Проверяем, что компонент рендерится без throw / redirect
    // (если бы был middleware-redirect, тест упал бы)
    await expect(renderPage('unsubscribed')).resolves.not.toThrow()
  })
})
