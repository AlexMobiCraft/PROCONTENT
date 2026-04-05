'use client'

import { createClient } from '@/lib/supabase/client'
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from '@/features/admin/types'
import { generateUUID } from '@/features/admin/api/uploadMedia'

const STORAGE_BUCKET = 'inline-images'

export interface UploadedInlineImage {
  url: string
  storage_bucket: 'inline-images'
}

function getSafeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function validateInlineImage(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Dovoljene so samo slike JPG, PNG, WEBP ali GIF')
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error('Slika je prevelika. Največja dovoljena velikost je 10 MB')
  }
}

export async function uploadInlineImage(file: File): Promise<UploadedInlineImage> {
  validateInlineImage(file)

  const supabase = createClient()
  const path = `editor/${generateUUID()}/${getSafeFileName(file.name)}`

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    upsert: false,
    cacheControl: '3600',
  })

  if (error) {
    throw new Error(`Napaka pri nalaganju slike: ${error.message}`, { cause: error })
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)

  return {
    url: data.publicUrl,
    storage_bucket: STORAGE_BUCKET,
  }
}
