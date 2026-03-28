interface EmailPreferencesPageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function EmailPreferencesPage({ searchParams }: EmailPreferencesPageProps) {
  const { status } = await searchParams

  if (status === 'unsubscribed') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-4 text-center">
          <div className="text-4xl">✓</div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            Odjava uspešna
          </h1>
          <p className="text-sm text-muted-foreground">
            Uspešno ste se odjavili od e-poštnih obvestil.
          </p>
          <a
            href="/login"
            className="inline-block text-sm text-primary underline underline-offset-4"
          >
            Prijavite se v račun
          </a>
        </div>
      </main>
    )
  }

  if (status === 'invalid_or_expired') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-4 text-center">
          <div className="text-4xl">✗</div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            Neveljavna povezava
          </h1>
          <p className="text-sm text-muted-foreground">
            Povezava za odjavo je neveljavna ali je potekla.
          </p>
          <a
            href="/login"
            className="inline-block text-sm text-primary underline underline-offset-4"
          >
            Prijavite se v račun
          </a>
        </div>
      </main>
    )
  }

  // Fallback для неизвестного status — без раскрытия деталей
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          E-poštne nastavitve
        </h1>
        <p className="text-sm text-muted-foreground">Status odjave ni na voljo.</p>
        <a
          href="/login"
          className="inline-block text-sm text-primary underline underline-offset-4"
        >
          Prijavite se v račun
        </a>
      </div>
    </main>
  )
}
