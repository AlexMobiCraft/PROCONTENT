import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TestimonialsSection } from '@/features/landing/components/TestimonialsSection'

describe('TestimonialsSection', () => {
  it('рендерится без ошибок', () => {
    render(<TestimonialsSection />)

    expect(screen.getByText('Kaj pravijo')).toBeInTheDocument()
  })

  it('отображает 4 карточки отзывов как blockquote', () => {
    render(<TestimonialsSection />)

    const blockquotes = screen.getAllByRole('blockquote')
    expect(blockquotes).toHaveLength(4)
  })

  it('отображает подписи реальных отзывов', () => {
    render(<TestimonialsSection />)

    const labels = screen.getAllByText('Resnično mnenje članice')
    expect(labels).toHaveLength(4)
  })

  it('содержит реальные тексты отзывов', () => {
    render(<TestimonialsSection />)

    expect(screen.getByText(/Navdusena res/i)).toBeInTheDocument()
    expect(screen.getByText(/včlanila v tvoj ProContent channel/i)).toBeInTheDocument()
    expect(screen.getByText(/Kako huda in poučna objava/i)).toBeInTheDocument()
    expect(screen.getByText(/to je to, kar sem iskala/i)).toBeInTheDocument()
  })

  it('отображает заголовок секции "Отзывы"', () => {
    render(<TestimonialsSection />)

    expect(screen.getByText('Mnenja')).toBeInTheDocument()
  })
})
