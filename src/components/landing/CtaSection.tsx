'use client'

import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function CtaSection() {
  return (
    <section className="bg-foreground px-5 py-16">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium tracking-[0.2em] uppercase" style={{ color: 'oklch(0.75 0.1 35)' }}>
            Готова?
          </p>
          <h2 className="font-heading text-primary-foreground text-balance text-2xl font-semibold leading-snug">
            Твоя стая ждёт тебя
          </h2>
          <p className="text-primary-foreground/60 text-sm leading-relaxed max-w-xs mx-auto">
            Присоединяйся к закрытому клубу создательниц контента и начни расти вместе.
          </p>
        </div>

        <Link
          href="/login"
          className={cn(
            buttonVariants({ size: 'lg' }),
            'min-w-[200px] bg-primary text-primary-foreground text-base font-medium hover:bg-primary/90'
          )}
        >
          Вступить в клуб
        </Link>

        <p className="text-primary-foreground/40 text-xs">
          Уже участница?{' '}
          <Link
            href="/login"
            className="text-primary-foreground/60 underline underline-offset-4 hover:text-primary-foreground"
          >
            Войти
          </Link>
        </p>
      </div>
    </section>
  )
}
