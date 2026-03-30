'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateSettings } from '@/features/admin/api/settings'

const WhatsAppSettingsSchema = z.object({
  whatsapp_url: z
    .string()
    .trim()
    .min(1, 'URL je obvezen')
    .url('Vnesite veljaven URL (npr. https://chat.whatsapp.com/...)'),
})

type WhatsAppSettingsValues = z.infer<typeof WhatsAppSettingsSchema>

interface WhatsAppSettingsFormProps {
  initialWhatsappUrl: string
}

export function WhatsAppSettingsForm({ initialWhatsappUrl }: WhatsAppSettingsFormProps) {
  const [savedUrl, setSavedUrl] = useState(initialWhatsappUrl)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<WhatsAppSettingsValues>({
    defaultValues: {
      whatsapp_url: initialWhatsappUrl,
    },
  })

  async function onSubmit(values: WhatsAppSettingsValues) {
    const parsed = WhatsAppSettingsSchema.safeParse(values)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      if (firstIssue) {
        setError('whatsapp_url', { message: firstIssue.message })
      }
      return
    }

    try {
      const updated = await updateSettings({ whatsapp_url: parsed.data.whatsapp_url })
      setSavedUrl(updated.whatsapp_url)
      toast.success('Nastavitve so bile shranjene')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Napaka pri shranjevanju'
      toast.error(message)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="whatsapp_url" className="text-sm font-medium">
          WhatsApp URL
        </label>
        <Input
          id="whatsapp_url"
          type="url"
          aria-label="WhatsApp skupinska povezava"
          {...register('whatsapp_url')}
          disabled={isSubmitting}
          aria-invalid={!!errors.whatsapp_url}
          placeholder="https://chat.whatsapp.com/..."
        />
        {errors.whatsapp_url && (
          <p className="text-xs text-destructive" role="alert">
            {errors.whatsapp_url.message}
          </p>
        )}
        {savedUrl && (
          <p className="text-xs text-muted-foreground">
            Trenutna vrednost:{' '}
            <a
              href={savedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              {savedUrl}
            </a>
          </p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            <span>Shranjevanje...</span>
          </>
        ) : (
          'Shrani nastavitve'
        )}
      </Button>
    </form>
  )
}
