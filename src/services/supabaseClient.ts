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
  holes: 9 | 18 | null
}

export type TeeTimeInsert = {
  date: string
  time: string
  price: number
  spots_total: number
  spots_remaining: number
  description?: string | null
  is_available?: boolean
  holes?: 9 | 18 | null
}

export type TeeTimeUpdate = Partial<TeeTimeInsert>

export type BookingStatus = 'confirmed' | 'cancelled' | 'refunded'

export type PaymentStatus = 'unpaid' | 'paid'

/** Confirmed tee time booking shown on agent portal cards. */
export type TeeTimeBookingRow = {
  id: string
  tee_time_id: string
  guest_name: string
  phone: string | null
  email: string | null
  golfers: number
  status: BookingStatus
  payment_status: PaymentStatus
  paid_at: string | null
  created_at: string
}

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
      bookings: {
        Row: TeeTimeBookingRow & {
          booking_type: 'tee_time' | 'tournament'
          tournament_id: string | null
          amount_cents: number
          square_payment_id: string | null
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      book_tee_time_agent: {
        Args: {
          p_tee_time_id: string
          p_guest_name: string
          p_phone: string
          p_golfers: number
          p_email?: string | null
        }
        Returns: {
          booking_id: string
          spots_remaining: number
        }
      }
      set_booking_payment_status: {
        Args: {
          p_booking_id: string
          p_paid: boolean
        }
        Returns: {
          booking_id: string
          payment_status: PaymentStatus
          paid_at: string | null
        }
      }
      cancel_tee_time_booking: {
        Args: {
          p_booking_id: string
        }
        Returns: {
          booking_id: string
          tee_time_id: string
          spots_remaining: number
        }
      }
      move_tee_time_booking: {
        Args: {
          p_booking_id: string
          p_new_tee_time_id: string
        }
        Returns: {
          booking_id: string
          old_tee_time_id: string
          new_tee_time_id: string
          old_spots_remaining: number
          new_spots_remaining: number
        }
      }
      update_booking_contact: {
        Args: {
          p_booking_id: string
          p_guest_name: string
          p_phone: string
          p_email?: string | null
          p_golfers: number
        }
        Returns: {
          booking_id: string
          guest_name: string
          phone: string
          email: string | null
          golfers: number
          tee_time_id: string
          spots_remaining: number
        }
      }
    }
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
