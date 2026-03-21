import Link from 'next/link'

export default function InactivePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <h1 className="mb-4 text-2xl font-semibold">Naročnina ni aktivna</h1>
      <p className="mb-8 text-muted-foreground">
        Vaša naročnina je bila preklicana ali je rok plačila potekel. Za obnovitev dostopa posodobite
        naročnino.
      </p>
      <Link
        href="/"
        className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Na glavno stran
      </Link>
    </main>
  )
}
