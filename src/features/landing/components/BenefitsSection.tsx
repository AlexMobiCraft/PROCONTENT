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
    <section className="bg-background px-5 py-16">
      <div className="mx-auto max-w-xl">
        <div className="mb-10 flex flex-col gap-2">
          <p className="text-xs font-medium tracking-[0.3em] uppercase text-primary">
            Что внутри
          </p>
          <h2 className="font-serif text-foreground text-balance text-[clamp(2rem,8vw,3.5rem)] font-light leading-none uppercase">
            Всё для роста
          </h2>
        </div>

        <div className="flex flex-col gap-6">
          {benefits.map((benefit) => {
            const Icon = benefit.icon
            return (
              <div key={benefit.title} className="flex gap-4">
                <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="size-5 text-primary" aria-hidden />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="font-serif text-foreground text-xl font-light uppercase tracking-wide">
                    {benefit.title}
                  </h3>
                  <p className="text-xs tracking-[0.1em] uppercase leading-relaxed text-muted-foreground">
                    {benefit.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
