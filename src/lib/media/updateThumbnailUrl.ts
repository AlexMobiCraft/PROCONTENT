import { createClient } from '@/lib/supabase/client'

export async function updateThumbnailUrl(
  postMediaId: string,
  thumbnailUrl: string
): Promise<void> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('post_media')
    .update({ thumbnail_url: thumbnailUrl })
    .eq('id', postMediaId)
    .select('id')

  if (error) {
    throw new Error(`Napaka pri shranjevanju posterja: ${error.message}`, { cause: error })
  }

  if (!data || data.length === 0) {
    throw new Error(
      `Napaka pri shranjevanju posterja: vrstica post_media ${postMediaId} ni bila posodobljena`
    )
  }
}
