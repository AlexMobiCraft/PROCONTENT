'use client'

import { useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { updateProfile, uploadAvatar, deleteAvatarFile } from '@/features/profile/api/profileApi'

// eslint-disable-next-line camelcase
interface ProfileEditCardProps {
  userId: string
  first_name: string
  avatar_url: string | null
  // eslint-disable-next-line camelcase
  onProfileUpdate?: (updates: { first_name?: string; avatar_url?: string | null }) => void
}

export function ProfileEditCard({
  userId,
  first_name,
  avatar_url,
  onProfileUpdate,
}: ProfileEditCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(first_name)
  const [isLoading, setIsLoading] = useState(false)
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatar_url)
  const [validationError, setValidationError] = useState<string | null>(null)

  async function handleSaveName() {
    if (!editedName.trim()) {
      setValidationError('Polje je obvezno')
      return
    }
    if (editedName.length < 3) {
      setValidationError('Najmanj 3 znaki')
      return
    }

    setIsLoading(true)
    setValidationError(null)

    try {
      // eslint-disable-next-line camelcase
      await updateProfile(userId, { first_name: editedName })
      toast.success('Ime je bilo posodobljeno')
      setIsEditing(false)
      // eslint-disable-next-line camelcase
      onProfileUpdate?.({ first_name: editedName })
    } catch (error) {
      setEditedName(first_name) // Rollback
      toast.error(error instanceof Error ? error.message : 'Napaka pri posodobitvi imena')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCancel() {
    setEditedName(first_name)
    setValidationError(null)
    setIsEditing(false)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0]
    if (!file) return

    setIsLoading(true)

    try {
      const newAvatarUrl = await uploadAvatar(userId, file)

      // Update profile with new avatar URL
      const oldAvatarUrl = currentAvatarUrl
      setCurrentAvatarUrl(newAvatarUrl)

      await updateProfile(userId, { avatar_url: newAvatarUrl })

      // Clean up old avatar if it exists
      if (oldAvatarUrl) {
        await deleteAvatarFile(oldAvatarUrl).catch(() => {
          // Ignore cleanup errors
        })
      }

      toast.success('Avatar je bil naložen')
      onProfileUpdate?.({ avatar_url: newAvatarUrl })
    } catch (error) {
      // Rollback avatar URL in UI
      setCurrentAvatarUrl(currentAvatarUrl)
      toast.error(error instanceof Error ? error.message : 'Napaka pri nalaganju avatarja')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="border border-border bg-card p-6 space-y-4">
      <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Uredi profil
      </h2>

      {/* Avatar Section */}
      <div className="flex items-center gap-4">
        {currentAvatarUrl ? (
          <Image
            src={currentAvatarUrl}
            alt="Avatar"
            width={64}
            height={64}
            className="w-16 h-16 rounded-full object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <span className="text-muted-foreground text-xs">Ni slike</span>
          </div>
        )}

        <div className="flex-1">
          <label
            htmlFor="avatar-upload"
            className="inline-flex items-center justify-center border border-primary px-4 py-2 font-sans text-xs font-medium tracking-[0.1em] uppercase text-foreground transition-colors hover:bg-primary/10 disabled:opacity-50 cursor-pointer"
          >
            Naloži avatar
          </label>
          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            disabled={isLoading}
            onChange={handleAvatarUpload}
            className="hidden"
          />
          <p className="text-[10px] text-muted-foreground mt-1">Največja velikost: 5 MB</p>
        </div>
      </div>

      {/* Name Edit Section */}
      <div className="border-t border-border pt-4 space-y-3">
        <label htmlFor="edit-first-name" className="block text-sm font-medium text-foreground">
          Ime
        </label>

        {!isEditing ? (
          <div className="flex items-center justify-between">
            {/* eslint-disable-next-line camelcase */}
            <p className="text-sm text-foreground">{first_name}</p>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              disabled={isLoading}
              className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Uredi
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              id="edit-first-name"
              type="text"
              value={editedName}
              onChange={(e) => {
                setEditedName(e.target.value)
                setValidationError(null)
              }}
              disabled={isLoading}
              minLength={3}
              className={cn(
                'border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring/50 focus:border-ring min-h-[44px] rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none disabled:opacity-50 w-full',
                validationError &&
                  'border-destructive focus:ring-destructive/20 focus:border-destructive'
              )}
            />
            {validationError && (
              <p role="alert" className="text-destructive text-sm">
                {validationError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveName}
                disabled={isLoading}
                className="flex-1 inline-flex items-center justify-center border border-primary px-4 py-2 font-sans text-xs font-medium tracking-[0.1em] uppercase text-foreground transition-colors hover:bg-primary/10 disabled:opacity-50"
              >
                {isLoading ? 'Shranjevanje...' : 'Shrani'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isLoading}
                className="flex-1 inline-flex items-center justify-center border border-muted-foreground px-4 py-2 font-sans text-xs font-medium tracking-[0.1em] uppercase text-muted-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
              >
                Prekliči
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
