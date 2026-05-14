import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Aligns with `public.tee_times` in Supabase. */
export type TeeTimeRow = {
  id: string
  date: string
  time: string
  price: number
  spots_total: number
  spots_remaining: number
  description: string | null
  is_available: boolean
  created_at: string
  updated_at: string
  holes: 9 | 18
}

export type TeeTimeInsert = {
  date: string
  time: string
  price: number
  spots_total: number
  spots_remaining: number
  description?: string | null
  is_available?: boolean
  holes?: 9 | 18
}

export type TeeTimeUpdate = Partial<TeeTimeInsert>

export type TournamentStatus =
  | 'draft'
  | 'open'
  | 'closed'
  | 'completed'

/** Aligns with `public.tournaments` in Supabase. */
export type TournamentRow = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  date: string
  start_time: string
  team_size: 1 | 2 | 4 | 6
  format: string | null
  holes: 9 | 18
  entry_fee_guest: number
  entry_fee_member: number | null
  mulligans_included: number
  lunch_included: boolean
  mulligan_price: number | null
  money_hole: number | null
  prize_pot: number | null
  spots_total: number
  spots_remaining: number
  status: TournamentStatus
  is_visible: boolean
  created_at: string
  updated_at: string
}

export type TournamentInsert = {
  name: string
  description?: string | null
  image_url?: string | null
  date: string
  start_time: string
  team_size: 1 | 2 | 4 | 6
  format?: string | null
  holes?: 9 | 18
  entry_fee_guest: number
  entry_fee_member?: number | null
  mulligans_included?: number
  lunch_included?: boolean
  mulligan_price?: number | null
  money_hole?: number | null
  prize_pot?: number | null
  spots_total: number
  spots_remaining: number
  status?: TournamentStatus
  is_visible?: boolean
}

export type TournamentUpdate = Partial<TournamentInsert>

export type Database = {
  public: {
    Tables: {
      tee_times: {
        Row: TeeTimeRow
        Insert: TeeTimeInsert
        Update: TeeTimeUpdate
        Relationships: []
      }
      tournaments: {
        Row: TournamentRow
        Insert: TournamentInsert
        Update: TournamentUpdate
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}

let client: SupabaseClient<Database> | null = null

function requireEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `Missing ${String(name)}. Add it to your Vite env (e.g. .env.local).`,
    )
  }
  return value
}

/**
 * Singleton browser Supabase client (anon key).
 * Call only after env vars are configured.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (!client) {
    const url = requireEnv('VITE_SUPABASE_URL')
    const anonKey = requireEnv('VITE_SUPABASE_ANON_KEY')
    client = createClient<Database>(url, anonKey)
  }
  return client
}
