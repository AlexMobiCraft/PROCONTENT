import { UpdatePasswordForm } from '@/features/auth/components/UpdatePasswordForm'

export const metadata = {
  title: 'Установка пароля | ProContent',
  description: 'Придумайте надежный пароль для доступа в клуб',
}

export default function UpdatePasswordPage() {
  return (
    <div className="flex w-full flex-col p-4 sm:p-8">
      <div className="flex w-full max-w-[400px] flex-col justify-center">
        <UpdatePasswordForm />
      </div>
    </div>
  )
}
