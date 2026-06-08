import { createClient } from '@/lib/supabase/client'

export async function updateThumbnailUrl(
  postMediaId: string,
  thumbnailUrl: string
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('post_media')
    .update({ thumbnail_url: thumbnailUrl })
    .eq('id', postMediaId)

  if (error) {
    throw new Error(`Napaka pri shranjevanju posterja: ${error.message}`, { cause: error })
  }
}
