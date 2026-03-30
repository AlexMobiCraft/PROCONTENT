import { createClient } from '@/lib/supabase/server'
import type { SiteSettings } from './settings'

export async function getSettingsServer(): Promise<SiteSettings> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('site_settings')
    .select('whatsapp_url')
    .eq('id', 1)
    .single()
  if (error) throw error
  return data
}
