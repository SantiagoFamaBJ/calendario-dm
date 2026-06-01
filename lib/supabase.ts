import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type ActivityType = string

export interface Category {
  id: string
  slug: string
  name: string
  color: string
  is_default: boolean
  sort_order: number
}

export interface Activity {
  id: string
  type: ActivityType
  category_slug: string
  name: string
  start_date: string
  end_date: string
  location: string
  vendedor: string
  dictante?: string
  created_at?: string
}

export const DEFAULT_COLORS = [
  '#f15922', '#2563eb', '#7c3aed', '#059669',
  '#0891b2', '#b45309', '#be185d', '#dc2626',
  '#65a30d', '#9333ea', '#c2410c', '#0369a1',
]
