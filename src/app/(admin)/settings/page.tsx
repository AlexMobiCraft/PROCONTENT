import { getSettingsServer } from '@/features/admin/api/settingsServer'
import { WhatsAppSettingsForm } from '@/features/admin/components/WhatsAppSettingsForm'

export const metadata = { title: 'Nastavitve spletnega mesta' }

export default async function SettingsPage() {
  const settings = await getSettingsServer()

  return (
    <main className="px-4 py-8">
      <h1 className="mb-2 font-heading text-2xl font-semibold">Nastavitve</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Globalne nastavitve spletnega mesta PROCONTENT.
      </p>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-medium">WhatsApp skupnost</h2>
        <WhatsAppSettingsForm initialWhatsappUrl={settings.whatsapp_url} />
      </section>
    </main>
  )
}
