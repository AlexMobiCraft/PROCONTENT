import { UpdatePasswordForm } from '@/features/auth/components/UpdatePasswordForm'

export const metadata = {
  title: 'Установка пароля | PROCONTENT',
  description: 'Придумайте надежный пароль для доступа в клуб',
}

export default function UpdatePasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <UpdatePasswordForm />
      </div>
    </main>
  )
}
