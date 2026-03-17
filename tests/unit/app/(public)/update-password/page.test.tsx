import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/features/auth/components/UpdatePasswordForm', () => ({
  UpdatePasswordForm: () => <div data-testid="update-password-form" />,
}))

import UpdatePasswordPage from '@/app/(public)/update-password/page'

describe('UpdatePasswordPage', () => {
  it('рендерит UpdatePasswordForm', () => {
    render(<UpdatePasswordPage />)
    expect(screen.getByTestId('update-password-form')).toBeInTheDocument()
  })
})
