import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TestimonialsSection } from '@/features/landing/components/TestimonialsSection'

describe('TestimonialsSection', () => {
  it('рендерится без ошибок', () => {
    render(<TestimonialsSection />)

    expect(screen.getByText('Kaj pravijo')).toBeInTheDocument()
  })

  it('отображает 3 карточки отзывов как blockquote', () => {
    render(<TestimonialsSection />)

    const blockquotes = screen.getAllByRole('blockquote')
    expect(blockquotes).toHaveLength(3)
  })

  it('отображает имена авторов', () => {
    render(<TestimonialsSection />)

    expect(screen.getByText('Maša K.')).toBeInTheDocument()
    expect(screen.getByText('Anja R.')).toBeInTheDocument()
    expect(screen.getByText('Lena V.')).toBeInTheDocument()
  })

  it('отображает бейджи статуса участниц', () => {
    render(<TestimonialsSection />)

    expect(screen.getByText('Izkušena')).toBeInTheDocument()
    const participantBadges = screen.getAllByText('Članica')
    expect(participantBadges).toHaveLength(2)
  })

  it('отображает роли авторов', () => {
    render(<TestimonialsSection />)

    expect(screen.getByText('UGC-ustvarjalka')).toBeInTheDocument()
    expect(screen.getByText('Začetnica ustvarjanja vsebin')).toBeInTheDocument()
    expect(screen.getByText('Lastnica majhnega podjetja')).toBeInTheDocument()
  })

  it('содержит текст цитат', () => {
    render(<TestimonialsSection />)

    expect(
      screen.getByText(/podpisala pogodbe s 4 blagovnimi znamkami/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/zastavim vprašanje brez strahu/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/snemati vsebino za svojo kavarno/i)
    ).toBeInTheDocument()
  })

  it('отображает заголовок секции "Отзывы"', () => {
    render(<TestimonialsSection />)

    expect(screen.getByText('Mnenja')).toBeInTheDocument()
  })
})
