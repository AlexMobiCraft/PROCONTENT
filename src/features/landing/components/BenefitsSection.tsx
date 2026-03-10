import { BookOpen, Users, Zap, Archive } from 'lucide-react'

const benefits = [
  {
    icon: BookOpen,
    title: '2 года базы знаний',
    description:
      'Сотни постов по съёмке, алгоритмам и работе с брендами — фильтруй по теме в один тап.',
  },
  {
    icon: Users,
    title: 'Своё комьюнити',
    description:
      'WhatsApp-чат, где можно задать «глупый» вопрос и получить честный ответ без осуждения.',
  },
  {
    icon: Zap,
    title: 'Живые разборы',
    description:
      'Разбор профилей, трендов и кейсов каждую неделю — чтобы применять знания сразу.',
  },
  {
    icon: Archive,
    title: 'Оффлайн-встречи',
    description:
      'Нетворкинг и коллаборации с другими создательницами контента в Словении.',
  },
]

export function BenefitsSection() {
  return (
    <section className="bg-background px-5 py-16" aria-label="Что внутри">
      <p className="font-sans text-xs tracking-[0.3em] uppercase text-primary mb-3">
        Что внутри
      </p>
      <h2
        className="font-serif font-light uppercase leading-none text-foreground mb-10"
        style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)' }}
      >
        Всё для роста
      </h2>

      <ul className="flex flex-col gap-6">
        {benefits.map((benefit) => {
          const Icon = benefit.icon
          return (
            <li key={benefit.title} className="flex gap-4 items-start">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="size-5 text-primary" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-serif text-xl font-light uppercase tracking-wide text-foreground">
                  {benefit.title}
                </h3>
                <p className="text-xs tracking-[0.1em] uppercase text-muted-foreground leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
