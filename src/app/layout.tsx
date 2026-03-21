import type { Metadata } from 'next'
import { Cormorant_Garamond, Barlow_Condensed } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

// Editorial serif for large headings — high-contrast thin/thick strokes
const cormorant = Cormorant_Garamond({
  variable: '--font-heading',
  subsets: ['latin', 'cyrillic'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
})

// Condensed uppercase sans-serif for body / UI
const barlow = Barlow_Condensed({
  variable: '--font-sans',
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'PROCONTENT — Klub ustvarjalcev vsebin',
    template: '%s | PROCONTENT',
  },
  description:
    'Zaprti klub za profesionalne ustvarjalce vsebin. Izobraževalni materiali, vpogledi in skupnost.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  ),
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="sl" className={`${cormorant.variable} ${barlow.variable}`}>
      <body className="antialiased">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
