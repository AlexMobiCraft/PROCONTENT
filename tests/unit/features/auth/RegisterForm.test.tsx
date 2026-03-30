import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RegisterForm } from '@/features/auth/components/RegisterForm'

describe('RegisterForm', () => {
  it('renders all input fields', () => {
    const mockOnSubmit = vi.fn()
    render(
      <RegisterForm
        email="test@example.com"
        onSubmit={mockOnSubmit}
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Najmanj 3 znaki')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Vaš priimek')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Najmanj 6 znakov')).toBeInTheDocument()
  })

  it('shows validation error when first_name is empty', async () => {
    const mockOnSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <RegisterForm
        email="test@example.com"
        onSubmit={mockOnSubmit}
        isLoading={false}
        error={null}
      />
    )

    const passwordInput = screen.getByPlaceholderText('Najmanj 6 znakov')
    await user.type(passwordInput, 'password123')

    const submitButton = screen.getByRole('button', { name: /Dokončaj registracijo/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Polje je obvezno')).toBeInTheDocument()
    })
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('shows validation error when first_name is less than 3 characters', async () => {
    const mockOnSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <RegisterForm
        email="test@example.com"
        onSubmit={mockOnSubmit}
        isLoading={false}
        error={null}
      />
    )

    const firstNameInput = screen.getByPlaceholderText('Najmanj 3 znaki')
    await user.type(firstNameInput, 'ab')

    const submitButton = screen.getByRole('button', { name: /Dokončaj registracijo/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Najmanj 3 znaki')).toBeInTheDocument()
    })
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('accepts first_name with exactly 3 characters', async () => {
    const mockOnSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <RegisterForm
        email="test@example.com"
        onSubmit={mockOnSubmit}
        isLoading={false}
        error={null}
      />
    )

    const firstNameInput = screen.getByPlaceholderText('Najmanj 3 znaki')
    const passwordInput = screen.getByPlaceholderText('Najmanj 6 znakov')

    await user.type(firstNameInput, 'Ana')
    await user.type(passwordInput, 'password123')

    const submitButton = screen.getByRole('button', { name: /Dokončaj registracijo/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        first_name: 'Ana',
        last_name: '',
        password: 'password123',
      })
    })
  })

  it('accepts first_name with special characters', async () => {
    const mockOnSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <RegisterForm
        email="test@example.com"
        onSubmit={mockOnSubmit}
        isLoading={false}
        error={null}
      />
    )

    const firstNameInput = screen.getByPlaceholderText('Najmanj 3 znaki')
    const passwordInput = screen.getByPlaceholderText('Najmanj 6 znakov')

    await user.type(firstNameInput, "Jean-Claude O'Brien")
    await user.type(passwordInput, 'password123')

    const submitButton = screen.getByRole('button', { name: /Dokončaj registracijo/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        first_name: "Jean-Claude O'Brien",
        last_name: '',
        password: 'password123',
      })
    })
  })

  it('shows validation error when password is empty', async () => {
    const mockOnSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <RegisterForm
        email="test@example.com"
        onSubmit={mockOnSubmit}
        isLoading={false}
        error={null}
      />
    )

    const firstNameInput = screen.getByPlaceholderText('Najmanj 3 znaki')
    await user.type(firstNameInput, 'Janez')

    const submitButton = screen.getByRole('button', { name: /Dokončaj registracijo/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Izmislite si geslo')).toBeInTheDocument()
    })
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('shows validation error when password is less than 6 characters', async () => {
    const mockOnSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <RegisterForm
        email="test@example.com"
        onSubmit={mockOnSubmit}
        isLoading={false}
        error={null}
      />
    )

    const firstNameInput = screen.getByPlaceholderText('Najmanj 3 znaki')
    const passwordInput = screen.getByPlaceholderText('Najmanj 6 znakov')

    await user.type(firstNameInput, 'Janez')
    await user.type(passwordInput, '12345')

    const submitButton = screen.getByRole('button', { name: /Dokončaj registracijo/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Geslo mora imeti vsaj 6 znakov')).toBeInTheDocument()
    })
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('submits form with all fields filled correctly', async () => {
    const mockOnSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <RegisterForm
        email="test@example.com"
        onSubmit={mockOnSubmit}
        isLoading={false}
        error={null}
      />
    )

    const firstNameInput = screen.getByPlaceholderText('Najmanj 3 znaki')
    const lastNameInput = screen.getByPlaceholderText('Vaš priimek')
    const passwordInput = screen.getByPlaceholderText('Najmanj 6 znakov')

    await user.type(firstNameInput, 'Janez')
    await user.type(lastNameInput, 'Novak')
    await user.type(passwordInput, 'password123')

    const submitButton = screen.getByRole('button', { name: /Dokončaj registracijo/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        first_name: 'Janez',
        last_name: 'Novak',
        password: 'password123',
      })
    })
  })

  it('disables submit button when loading', () => {
    const mockOnSubmit = vi.fn()
    render(
      <RegisterForm
        email="test@example.com"
        onSubmit={mockOnSubmit}
        isLoading={true}
        error={null}
      />
    )

    const submitButton = screen.getByRole('button', { name: /Trenutek/i })
    expect(submitButton).toBeDisabled()
  })
})
