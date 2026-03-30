import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfileEditCard } from '@/features/profile/components/ProfileEditCard'

// Mock the profile API
vi.mock('@/features/profile/api/profileApi', () => ({
  updateProfile: vi.fn(),
  uploadAvatar: vi.fn(),
  deleteAvatarFile: vi.fn(),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt }: any) => <img src={src} alt={alt} />,
}))

// Import mocked modules
import * as profileApi from '@/features/profile/api/profileApi'

describe('ProfileEditCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders profile edit card with first_name', () => {
    const mockOnUpdate = vi.fn()
    render(
      <ProfileEditCard
        userId="user-123"
        first_name="Janez"
        avatar_url={null}
        onProfileUpdate={mockOnUpdate}
      />
    )

    expect(screen.getByText('Janez')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Uredi/i })).toBeInTheDocument()
  })

  it('displays avatar image when avatar_url is provided', () => {
    const mockOnUpdate = vi.fn()
    render(
      <ProfileEditCard
        userId="user-123"
        first_name="Janez"
        avatar_url="https://example.com/avatar.jpg"
        onProfileUpdate={mockOnUpdate}
      />
    )

    const img = screen.getByAltText('Avatar') as HTMLImageElement
    expect(img.src).toContain('avatar.jpg')
  })

  it('shows "Ni slike" when no avatar', () => {
    const mockOnUpdate = vi.fn()
    render(
      <ProfileEditCard
        userId="user-123"
        first_name="Janez"
        avatar_url={null}
        onProfileUpdate={mockOnUpdate}
      />
    )

    expect(screen.getByText('Ni slike')).toBeInTheDocument()
  })

  it('enters edit mode when Uredi button is clicked', async () => {
    const user = userEvent.setup()
    const mockOnUpdate = vi.fn()
    render(
      <ProfileEditCard
        userId="user-123"
        first_name="Janez"
        avatar_url={null}
        onProfileUpdate={mockOnUpdate}
      />
    )

    const editButton = screen.getByRole('button', { name: /Uredi/i })
    await user.click(editButton)

    const input = screen.getByDisplayValue('Janez')
    expect(input).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Shrani/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Prekliči/i })).toBeInTheDocument()
  })

  it('shows validation error when first_name is empty', async () => {
    const user = userEvent.setup()
    const mockOnUpdate = vi.fn()
    render(
      <ProfileEditCard
        userId="user-123"
        first_name="Janez"
        avatar_url={null}
        onProfileUpdate={mockOnUpdate}
      />
    )

    const editButton = screen.getByRole('button', { name: /Uredi/i })
    await user.click(editButton)

    const input = screen.getByDisplayValue('Janez')
    await user.clear(input)

    const saveButton = screen.getByRole('button', { name: /Shrani/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('Polje je obvezno')).toBeInTheDocument()
    })
  })

  it('shows validation error when first_name is less than 3 characters', async () => {
    const user = userEvent.setup()
    const mockOnUpdate = vi.fn()
    render(
      <ProfileEditCard
        userId="user-123"
        first_name="Janez"
        avatar_url={null}
        onProfileUpdate={mockOnUpdate}
      />
    )

    const editButton = screen.getByRole('button', { name: /Uredi/i })
    await user.click(editButton)

    const input = screen.getByDisplayValue('Janez')
    await user.clear(input)
    await user.type(input, 'Jo')

    const saveButton = screen.getByRole('button', { name: /Shrani/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('Najmanj 3 znaki')).toBeInTheDocument()
    })
  })

  it('saves first_name successfully and calls onProfileUpdate', async () => {
    const user = userEvent.setup()
    const mockOnUpdate = vi.fn()
    const mockUpdateProfile = vi.mocked(profileApi.updateProfile)
    mockUpdateProfile.mockResolvedValue({ old_avatar_url: null })

    render(
      <ProfileEditCard
        userId="user-123"
        first_name="Janez"
        avatar_url={null}
        onProfileUpdate={mockOnUpdate}
      />
    )

    const editButton = screen.getByRole('button', { name: /Uredi/i })
    await user.click(editButton)

    const input = screen.getByDisplayValue('Janez')
    await user.clear(input)
    await user.type(input, 'Mateja')

    const saveButton = screen.getByRole('button', { name: /Shrani/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalled()
      expect(mockOnUpdate).toHaveBeenCalledWith({ first_name: 'Mateja' })
    })
  })

  it('exits edit mode when Prekliči button is clicked', async () => {
    const user = userEvent.setup()
    const mockOnUpdate = vi.fn()
    render(
      <ProfileEditCard
        userId="user-123"
        first_name="Janez"
        avatar_url={null}
        onProfileUpdate={mockOnUpdate}
      />
    )

    const editButton = screen.getByRole('button', { name: /Uredi/i })
    await user.click(editButton)

    const cancelButton = screen.getByRole('button', { name: /Prekliči/i })
    await user.click(cancelButton)

    await waitFor(() => {
      expect(screen.getByText('Janez')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Shrani/i })).not.toBeInTheDocument()
    })
  })
})
