import type { Metadata } from 'next'

import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm'

export const metadata: Metadata = {
  title: 'Сброс пароля | PROCONTENT',
}

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <ForgotPasswordForm />
      </div>
    </main>
  )
}
