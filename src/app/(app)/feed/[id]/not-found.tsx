import Link from 'next/link'

export default function PostNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="text-5xl font-bold text-muted-foreground/30">404</span>
        <h1 className="font-heading text-xl font-semibold text-foreground">
          Objava ni bila najdena
        </h1>
        <p className="text-sm text-muted-foreground">
          Te objave ne obstaja ali pa je bila izbrisana.
        </p>
      </div>
      <Link
        href="/feed"
        className="flex min-h-[44px] items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Nazaj na objave
      </Link>
    </div>
  )
}
