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
  const normalizedSlug = slug.toLowerCase().trim()
  const { data, error } = await supabase
    .from('categories')
    .insert({ name: name.trim(), slug: normalizedSlug })
    .select('id, name, slug, created_at')
    .single()
  if (error) {
    if (error.code === '23505') {
      throw new Error('Kategorija s tem imenom že obstaja')
    }
    throw error
  }
  if (!data) {
    throw new Error('Nepričakovana napaka: kategorija ni bila vrnjena po ustvarjanju')
  }
  return data
}

export async function deleteCategory(id: string): Promise<void> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .select('id')
  if (error) {
    if (
      error.code === '23503' ||
      (error.message ?? '').includes('FOREIGN KEY')
    ) {
      throw new Error('Kategorije ni mogoče izbrisati, ker jo uporabljajo objave')
    }
    throw error
  }
  if (!data || data.length === 0) {
    throw new Error('Kategorija ni bila najdena ali je bila že izbrisana')
  }
}
