import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/features/admin/components/PostForm', () => ({
  PostForm: ({ mode }: { mode: string }) => (
    <div data-testid="post-form" data-mode={mode} />
  ),
}))

import CreatePostPage from '@/app/(admin)/posts/create/page'

describe('CreatePostPage', () => {
  it('renders page heading', () => {
    render(<CreatePostPage />)
    expect(screen.getByRole('heading', { name: /nova objava/i })).toBeInTheDocument()
  })

  it('renders PostForm in create mode', () => {
    render(<CreatePostPage />)
    const form = screen.getByTestId('post-form')
    expect(form).toBeInTheDocument()
    expect(form).toHaveAttribute('data-mode', 'create')
  })
})
