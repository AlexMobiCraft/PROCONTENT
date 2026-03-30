import { createClient } from '@/lib/supabase/client'

export interface SiteSettings {
  whatsapp_url: string
}

export async function getSettings(): Promise<SiteSettings> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('site_settings')
    .select('whatsapp_url')
    .eq('id', 1)
    .single()
  if (error) throw error
  return data
}

export async function updateSettings(settings: Partial<SiteSettings>): Promise<SiteSettings> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('site_settings')
    .update(settings)
    .eq('id', 1)
    .select('whatsapp_url')
    .single()
  if (error) throw error
  if (!data) throw new Error('Nastavitve niso bile vrnjene po posodobitvi')
  return data
}
