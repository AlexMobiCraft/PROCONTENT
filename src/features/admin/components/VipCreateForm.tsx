'use client'

import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VipCreateSchema, type VipCreateValues } from '@/features/admin/types'

interface VipCreateFormProps {
  /** Создаёт VIP. Возвращает existing=true, если email уже был зарегистрирован. */
  onCreate: (values: VipCreateValues) => Promise<{ existing: boolean }>
}

export function VipCreateForm({ onCreate }: VipCreateFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<VipCreateValues>({
    defaultValues: { email: '', first_name: '' },
  })

  async function onSubmit(values: VipCreateValues) {
    const parsed = VipCreateSchema.safeParse(values)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (field === 'email' || field === 'first_name') {
          setError(field, { message: issue.message })
        }
      }
      return
    }

    try {
      const { existing } = await onCreate(parsed.data)
      toast.success(
        existing
          ? 'Uporabnik že obstaja, dodeljen VIP'
          : 'VIP ustvarjen — vabilo poslano na e-pošto'
      )
      reset()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Prišlo je do napake'
      toast.error(message)
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="mb-8 flex flex-col gap-4 rounded-lg border border-border p-4 sm:flex-row sm:items-start"
    >
      <div className="flex flex-1 flex-col gap-1.5">
        <label htmlFor="vip_first_name" className="text-sm font-medium">
          Ime
        </label>
        <Input
          id="vip_first_name"
          type="text"
          aria-label="Ime VIP uporabnika"
          {...register('first_name')}
          disabled={isSubmitting}
          aria-invalid={!!errors.first_name}
          placeholder="Ana"
        />
        {errors.first_name && (
          <p className="text-xs text-destructive" role="alert">
            {errors.first_name.message}
          </p>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        <label htmlFor="vip_email" className="text-sm font-medium">
          E-pošta
        </label>
        <Input
          id="vip_email"
          type="email"
          aria-label="E-pošta VIP uporabnika"
          {...register('email')}
          disabled={isSubmitting}
          aria-invalid={!!errors.email}
          placeholder="ana@primer.si"
        />
        {errors.email && (
          <p className="text-xs text-destructive" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting} className="sm:mt-7">
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            <span>Dodajanje...</span>
          </>
        ) : (
          'Dodaj VIP'
        )}
      </Button>
    </form>
  )
}
