import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type ActivityType = 'curso_dm' | 'curso_externo' | 'congreso' | 'viaje'

export interface Activity {
  id: string
  type: ActivityType
  name: string
  start_date: string
  end_date: string
  location: string
  vendedor: string
  dictante?: string
  created_at?: string
}
