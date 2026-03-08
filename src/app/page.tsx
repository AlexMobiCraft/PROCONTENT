'use client'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center selection:bg-primary/20">
      <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-2xl shadow-primary/30">
          <span className="text-primary-foreground font-heading text-2xl font-black">PRO</span>
        </div>

        <div className="flex flex-col gap-3">
          <h1 className="font-heading text-foreground text-4xl font-extrabold tracking-tight sm:text-6xl">
            PROCONTENT
          </h1>
          <p className="text-muted-foreground mx-auto max-w-md text-lg font-medium leading-relaxed">
            Эксклюзивное сообщество для тех, кто хочет расти быстрее. Практика, нетворкинг и инсайды.
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className={cn(
              buttonVariants({ size: 'lg' }),
              'h-14 rounded-full px-8 text-lg font-bold shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 bg-primary text-primary-foreground'
            )}
          >
            Вступить в клуб
          </Link>
          <Link
            href="/about"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'lg' }),
              'h-14 rounded-full px-8 text-lg font-semibold opacity-60'
            )}
          >
            Узнать больше
          </Link>
        </div>
      </div>

      <div className="absolute bottom-8 text-muted-foreground text-xs font-medium opacity-40">
        &copy; 2024 PROCONTENT. Все права защищены.
      </div>
    </main>
  )
}
