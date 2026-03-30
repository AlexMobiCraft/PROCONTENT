import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpdateSettings = vi.fn()

vi.mock('@/features/admin/api/settings', () => ({
  updateSettings: (...args: unknown[]) => mockUpdateSettings(...args),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { WhatsAppSettingsForm } from '@/features/admin/components/WhatsAppSettingsForm'

describe('WhatsAppSettingsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('рендерит поле URL и кнопку сохранения', () => {
    render(<WhatsAppSettingsForm initialWhatsappUrl="https://chat.whatsapp.com/initial" />)
    expect(screen.getByLabelText(/WhatsApp skupinska povezava/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Shrani nastavitve/i })).toBeInTheDocument()
  })

  it('предзаполняет поле из initialWhatsappUrl', () => {
    render(<WhatsAppSettingsForm initialWhatsappUrl="https://chat.whatsapp.com/test123" />)
    const input = screen.getByLabelText(/WhatsApp skupinska povezava/i) as HTMLInputElement
    expect(input.value).toBe('https://chat.whatsapp.com/test123')
  })

  it('успешно сохраняет валидный URL', async () => {
    const user = userEvent.setup()
    const { toast } = await import('sonner')
    mockUpdateSettings.mockResolvedValue({ whatsapp_url: 'https://chat.whatsapp.com/new' })
    render(<WhatsAppSettingsForm initialWhatsappUrl="https://chat.whatsapp.com/old" />)

    const input = screen.getByLabelText(/WhatsApp skupinska povezava/i)
    await user.clear(input)
    await user.type(input, 'https://chat.whatsapp.com/new')
    await user.click(screen.getByRole('button', { name: /Shrani nastavitve/i }))

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({ whatsapp_url: 'https://chat.whatsapp.com/new' })
      expect(toast.success).toHaveBeenCalledWith('Nastavitve so bile shranjene')
    })
  })

  it('показывает inline ошибку при невалидном URL', async () => {
    const user = userEvent.setup()
    render(<WhatsAppSettingsForm initialWhatsappUrl="https://chat.whatsapp.com/test" />)

    const input = screen.getByLabelText(/WhatsApp skupinska povezava/i)
    await user.clear(input)
    await user.type(input, 'not-a-url')
    await user.click(screen.getByRole('button', { name: /Shrani nastavitve/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/veljaven URL/i)
    })
    expect(mockUpdateSettings).not.toHaveBeenCalled()
  })

  it('показывает inline ошибку при пустом URL', async () => {
    const user = userEvent.setup()
    render(<WhatsAppSettingsForm initialWhatsappUrl="https://chat.whatsapp.com/test" />)

    const input = screen.getByLabelText(/WhatsApp skupinska povezava/i)
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: /Shrani nastavitve/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(mockUpdateSettings).not.toHaveBeenCalled()
  })

  it('показывает toast ошибку при сбое API', async () => {
    const user = userEvent.setup()
    const { toast } = await import('sonner')
    mockUpdateSettings.mockRejectedValue(new Error('Server error'))
    render(<WhatsAppSettingsForm initialWhatsappUrl="https://chat.whatsapp.com/test" />)

    await user.click(screen.getByRole('button', { name: /Shrani nastavitve/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Server error')
    })
  })
})
