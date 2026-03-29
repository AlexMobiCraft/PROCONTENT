import { createClient } from '@/lib/supabase/server'
import type { Category } from './categories'

export async function getCategoriesServer(): Promise<Category[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, created_at')
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}
