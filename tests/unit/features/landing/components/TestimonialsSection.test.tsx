import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TestimonialsSection } from '@/features/landing/components/TestimonialsSection'

describe('TestimonialsSection', () => {
  it('рендерится без ошибок', () => {
    render(<TestimonialsSection />)

    expect(screen.getByText('Что говорят')).toBeInTheDocument()
  })

  it('отображает 3 карточки отзывов как blockquote', () => {
    render(<TestimonialsSection />)

    const blockquotes = screen.getAllByRole('blockquote')
    expect(blockquotes).toHaveLength(3)
  })

  it('отображает имена авторов', () => {
    render(<TestimonialsSection />)

    expect(screen.getByText('Маша К.')).toBeInTheDocument()
    expect(screen.getByText('Аня Р.')).toBeInTheDocument()
    expect(screen.getByText('Лена В.')).toBeInTheDocument()
  })

  it('отображает бейджи статуса участниц', () => {
    render(<TestimonialsSection />)

    expect(screen.getByText('Опытная')).toBeInTheDocument()
    const participantBadges = screen.getAllByText('Участница')
    expect(participantBadges).toHaveLength(2)
  })

  it('отображает роли авторов', () => {
    render(<TestimonialsSection />)

    expect(screen.getByText('UGC-криэйтор')).toBeInTheDocument()
    expect(screen.getByText('Начинающий контент-мейкер')).toBeInTheDocument()
    expect(screen.getByText('Владелица малого бизнеса')).toBeInTheDocument()
  })

  it('содержит текст цитат', () => {
    render(<TestimonialsSection />)

    expect(
      screen.getByText(/подписала контракты с 4 брендами/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/задать вопрос без страха/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/снимать контент для своего кафе/i)
    ).toBeInTheDocument()
  })

  it('отображает заголовок секции "Отзывы"', () => {
    render(<TestimonialsSection />)

    expect(screen.getByText('Отзывы')).toBeInTheDocument()
  })
})
