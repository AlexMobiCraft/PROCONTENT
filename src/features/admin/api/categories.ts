import { createClient } from '@/lib/supabase/client'

export interface Category {
  id: string
  name: string
  slug: string
  created_at: string
}

export async function getCategories(): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, created_at')
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createCategory(name: string, slug: string): Promise<Category> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categories')
    .insert({ name, slug })
    .select('id, name, slug, created_at')
    .single()
  if (error) {
    if (error.code === '23505') {
      throw new Error('Kategorija s tem imenom že obstaja')
    }
    throw error
  }
  return data
}

export async function deleteCategory(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
  if (error) {
    if (error.code === '23503') {
      throw new Error('Kategorije ni mogoče izbrisati, ker jo uporabljajo objave')
    }
    throw error
  }
}
