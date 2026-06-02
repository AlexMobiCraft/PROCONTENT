'use client'

import { createClient } from '@/lib/supabase/client'
import { compressAvatar } from '@/features/profile/lib/compressAvatar'

const AVATARS_BUCKET = 'avatars'
// Жёсткий предохранитель памяти браузера: больше — отклоняем до сжатия.
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024 // 50MB

// Fix #5: белый список допустимых MIME-типов
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

/**
 * Detects HEIC/HEIF files (iPhone default) by MIME type or filename extension.
 * Some browsers report an empty `type` for HEIC, so we also check the name.
 */
function isHeic(file: File): boolean {
  const type = file.type.toLowerCase()
  if (type.includes('heic') || type.includes('heif')) {
    return true
  }
  return /\.(heic|heif)$/i.test(file.name)
}

/**
 * Generates a unique storage path for an avatar file.
 * Format: {userId}/{randomUUID}/{filename}
 */
function generateAvatarPath(userId: string, fileName: string): string {
  const uuid = crypto.randomUUID()
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${userId}/${uuid}/${safeFileName}`
}

/**
 * Uploads an avatar to Supabase Storage.
 * Returns the public URL on success.
 */
export async function uploadAvatar(
  userId: string,
  file: File,
  onPhase?: (phase: 'processing' | 'uploading') => void
): Promise<string> {
  // Все проверки — по ОРИГИНАЛУ, до сжатия (иначе валидируем собственный выход).

  // 0-byte файл
  if (file.size === 0) {
    throw new Error('Datoteka ne sme biti prazna')
  }

  // HEIC/HEIF (дефолт iPhone) Canvas не декодирует — внятный отказ вместо тихого провала.
  if (isHeic(file)) {
    throw new Error('HEIC ni podprt. Shranite kot JPEG.')
  }

  // MIME whitelist
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error('Samo slike (JPEG, PNG, GIF, WebP) so dovoljene')
  }

  // Жёсткий потолок памяти
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new Error('Datoteka je prevelika (max 50 MB). Pomanjšajte sliko.')
  }

  // Сжатие на клиенте: > 256 КБ → center-crop 512×512 / ~200 КБ; ≤ 256 КБ — как есть.
  onPhase?.('processing')
  const toUpload = await compressAvatar(file)

  onPhase?.('uploading')
  const supabase = createClient()
  const path = generateAvatarPath(userId, toUpload.name)

  const { error } = await supabase.storage.from(AVATARS_BUCKET).upload(path, toUpload, {
    upsert: false,
    cacheControl: '3600',
    contentType: toUpload.type,
  })

  if (error) {
    throw new Error(`Napaka pri nalaganju slike: ${error.message}`, { cause: error })
  }

  const { data: urlData } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path)
  return urlData.publicUrl
}

/**
 * Updates the user's profile with optimistic updates.
 * Returns the old avatar_url for rollback on error.
 */
export async function updateProfile(
  userId: string,
  updates: { first_name?: string; avatar_url?: string }
): Promise<{ old_avatar_url: string | null }> {
  const supabase = createClient()

  // Fetch current profile to get old avatar_url for rollback
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', userId)
    .single()

  const oldAvatarUrl = currentProfile?.avatar_url ?? null

  // Update profile
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId)

  if (error) {
    throw new Error(`Napaka pri posodobitvi profila: ${error.message}`, { cause: error })
  }

  return { old_avatar_url: oldAvatarUrl }
}

/**
 * Deletes a file from Supabase Storage.
 * Used for cleanup when avatar upload fails or old avatar is replaced.
 */
export async function deleteAvatarFile(avatarUrl: string): Promise<void> {
  const supabase = createClient()

  // Extract path from public URL
  // URL format: https://xxxxx.supabase.co/storage/v1/object/public/avatars/path/to/file
  const match = avatarUrl.match(/\/avatars\/(.+)$/)
  if (!match) {
    console.warn('Napaka pri razčlenjevanju URL avatarja:', avatarUrl)
    return
  }

  const path = match[1]

  // Best-effort deletion — don't throw on error
  const { error } = await supabase.storage.from(AVATARS_BUCKET).remove([path])

  if (error) {
    console.warn('Napaka pri brisanju starega avatarja:', error)
  }
}
