export default function ProfileLoading() {
  return (
    <main className="mx-auto max-w-lg space-y-8 px-4 py-12">
      {/* h1 "Профиль": text-2xl font-semibold */}
      <div className="h-7 w-28 animate-pulse bg-muted" />

      {/* Блок аккаунта: space-y-2 border p-6 */}
      <div className="space-y-2 border border-border p-6">
        <div className="h-3 w-14 animate-pulse bg-muted" />
        <div className="h-5 w-44 animate-pulse bg-muted" />
        <div className="h-4 w-52 animate-pulse bg-muted" />
      </div>

      {/* Блок подписки: space-y-4 border p-6 */}
      <div className="space-y-4 border border-border p-6">
        <div>
          <div className="mb-1 h-3 w-14 animate-pulse bg-muted" />
          <div className="h-5 w-40 animate-pulse bg-muted" />
        </div>
        {/* Кнопка "Управление подпиской": size="sm" min-h-[44px] */}
        <div className="h-11 w-52 animate-pulse bg-muted" />
      </div>
    </main>
  )
}
