import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Barlow_Condensed } from 'next/font/google'
import './globals.css'

// Editorial serif for large headings — high-contrast thin/thick strokes
const cormorant = Cormorant_Garamond({
  variable: '--font-heading',
  subsets: ['latin', 'cyrillic'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
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
    default: 'PROCONTENT — Закрытое сообщество',
    template: '%s | PROCONTENT',
  },
  description:
    'Закрытый клуб для создательниц контента в Словении. База знаний, живое комьюнити и оффлайн-встречи.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  ),
  keywords: ['контент', 'комьюнити', 'UGC', 'Словения', 'creators'],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FDFBF7',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className={`${cormorant.variable} ${barlow.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  )
}
