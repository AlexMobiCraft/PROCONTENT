import Link from 'next/link'

export default function InactivePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <h1 className="mb-4 text-2xl font-semibold">Подписка неактивна</h1>
      <p className="mb-8 text-muted-foreground">
        Ваша подписка была отменена или срок оплаты истёк. Для восстановления доступа обновите
        подписку.
      </p>
      <Link
        href="/"
        className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        На главную
      </Link>
    </main>
  )
}
