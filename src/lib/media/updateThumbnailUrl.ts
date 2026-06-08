import { createClient } from '@/lib/supabase/client'

/**
 * Обновляет поле thumbnail_url записи post_media (Story 8.1, AC 1).
 *
 * @throws Error при ошибке БД
 */
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
