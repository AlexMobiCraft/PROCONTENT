import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { LazyMediaWrapper } from '@/components/media/LazyMediaWrapper'

vi.mock('next/image', () => ({
  default: (props: any) => <img {...props} />
}))

window.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

describe('LazyMediaWrapper Debug', () => {
  it('применяет класс аспекта', () => {
    const { container } = render(
      <LazyMediaWrapper 
        src="https://example.com/image.jpg" 
        alt="Test" 
        aspectRatio="4/5"
      />
    )
    const element = container.firstChild as HTMLElement
    console.log('CLASSES:', element.className)
    expect(element.className).toContain('aspect-[4/5]')
  })
})
