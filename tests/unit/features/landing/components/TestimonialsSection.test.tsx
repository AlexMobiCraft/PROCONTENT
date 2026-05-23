import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('отображает отзывы как раскрывающиеся карточки', () => {
    render(<TestimonialsSection />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(4)
    expect(screen.getAllByText('Prikaži več')).toHaveLength(4)
    buttons.forEach((button) => {
      expect(button).toHaveAttribute('aria-expanded', 'false')
      expect(button.querySelector('p')).toHaveClass('line-clamp-4')
    })
  })

  it('содержит реальные тексты отзывов', () => {
    render(<TestimonialsSection />)

    expect(screen.getByText(/Navdusena res/i)).toBeInTheDocument()
    expect(screen.getByText(/včlanila v tvoj ProContent channel/i)).toBeInTheDocument()
    expect(screen.getByText(/Kako huda in poučna objava/i)).toBeInTheDocument()
    expect(screen.getByText(/to je to, kar sem iskala/i)).toBeInTheDocument()
  })

  it('раскрывает полный текст отзыва по клику на карточку', async () => {
    const user = userEvent.setup()
    render(<TestimonialsSection />)

    const [firstButton] = screen.getAllByRole('button')
    const text = firstButton.querySelector('p')

    expect(firstButton).toHaveAttribute('aria-expanded', 'false')
    expect(text).toHaveClass('line-clamp-4')

    await user.click(firstButton)

    expect(firstButton).toHaveAttribute('aria-expanded', 'true')
    expect(text).not.toHaveClass('line-clamp-4')
    expect(firstButton).toHaveTextContent('Prikaži manj')
  })

  it('отображает заголовок секции "Отзывы"', () => {
    render(<TestimonialsSection />)

    expect(screen.getByText('Mnenja')).toBeInTheDocument()
  })
})
