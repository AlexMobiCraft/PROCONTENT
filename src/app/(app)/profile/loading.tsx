export default function ProfileLoading() {
  return (
    <main className="flex min-h-screen flex-col pb-[60px] md:flex-row md:pb-0">
      {/* Центральная колонка */}
      <div className="flex min-w-0 flex-1 flex-col md:border-r md:border-border">
        {/* Sticky header */}
        <div className="flex h-[var(--header-height)] shrink-0 items-center border-b border-border px-6">
          <div className="h-5 w-16 animate-pulse bg-muted" />
        </div>

        <div className="space-y-4 p-6">
          {/* Блок аккаунта */}
          <div className="space-y-2 border border-border p-6">
            <div className="h-3 w-14 animate-pulse bg-muted" />
            <div className="h-5 w-44 animate-pulse bg-muted" />
            <div className="h-4 w-52 animate-pulse bg-muted" />
          </div>

          {/* Блок подписки */}
          <div className="space-y-4 border border-border p-6">
            <div>
              <div className="mb-1 h-3 w-14 animate-pulse bg-muted" />
              <div className="h-5 w-40 animate-pulse bg-muted" />
            </div>
            <div className="h-9 w-52 animate-pulse bg-muted" />
          </div>
        </div>
      </div>

      {/* Правая панель */}
      <div className="hidden md:flex md:w-[350px] md:shrink-0 md:flex-col">
        {/* Шапка */}
        <div className="flex h-[var(--header-height)] shrink-0 items-center border-b border-border px-6">
          <div className="h-3 w-24 animate-pulse bg-muted" />
        </div>

        <div className="flex flex-col items-center gap-4 px-6 py-6">
          {/* Аватар */}
          <div className="size-20 animate-pulse rounded-full bg-muted" />
          {/* Имя */}
          <div className="h-5 w-32 animate-pulse bg-muted" />
          {/* Email */}
          <div className="h-4 w-40 animate-pulse bg-muted" />
          {/* Badge статуса */}
          <div className="h-6 w-28 animate-pulse rounded-full bg-muted" />

          {/* Достижения */}
          <div className="mt-2 w-full space-y-3">
            <div className="h-3 w-20 animate-pulse bg-muted" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3 rounded-md border border-border p-3">
                <div className="mt-0.5 size-5 shrink-0 animate-pulse rounded-sm bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-24 animate-pulse bg-muted" />
                  <div className="h-3 w-full animate-pulse bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
