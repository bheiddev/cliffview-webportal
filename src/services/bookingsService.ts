import { getSupabaseClient, type TeeTimeBookingRow } from './supabaseClient.ts'

export type AgentBookingInput = {
  guestName: string
  phone: string
  golfers: number
}

export type AgentBookingResult =
  | {
      data: {
        bookingId: string
        spotsRemaining: number
        booking: TeeTimeBookingRow
      }
      error: null
    }
  | { data: null; error: Error }

export type ListTeeTimeBookingsResult =
  | { data: TeeTimeBookingRow[]; error: null }
  | { data: null; error: Error }

export async function listTeeTimeBookings(
  teeTimeIds: string[],
): Promise<ListTeeTimeBookingsResult> {
  if (teeTimeIds.length === 0) {
    return { data: [], error: null }
  }

  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('bookings')
      .select(
        'id, tee_time_id, guest_name, phone, golfers, status, source, created_at',
      )
      .eq('booking_type', 'tee_time')
      .eq('status', 'confirmed')
      .in('tee_time_id', teeTimeIds)
      .order('created_at', { ascending: true })

    if (error) {
      return { data: null, error: new Error(error.message) }
    }

    return { data: (data ?? []) as TeeTimeBookingRow[], error: null }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { data: null, error: new Error(message) }
  }
}

export async function bookTeeTimeForGuest(
  teeTimeId: string,
  input: AgentBookingInput,
): Promise<AgentBookingResult> {
  const guestName = input.guestName.trim()
  const phone = input.phone.trim()

  if (!guestName) {
    return { data: null, error: new Error('Guest name is required.') }
  }
  if (!phone) {
    return { data: null, error: new Error('Phone number is required.') }
  }
  if (!Number.isInteger(input.golfers) || input.golfers < 1) {
    return { data: null, error: new Error('At least one golfer is required.') }
  }

  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('book_tee_time_agent', {
      p_tee_time_id: teeTimeId,
      p_guest_name: guestName,
      p_phone: phone,
      p_golfers: input.golfers,
    })

    if (error) {
      return { data: null, error: new Error(error.message) }
    }

    const body = data as {
      booking_id?: string
      spots_remaining?: number
    } | null

    if (!body?.booking_id || body.spots_remaining === undefined) {
      return {
        data: null,
        error: new Error('Booking succeeded but the response was incomplete.'),
      }
    }

    const booking: TeeTimeBookingRow = {
      id: body.booking_id,
      tee_time_id: teeTimeId,
      guest_name: guestName,
      phone,
      golfers: input.golfers,
      status: 'confirmed',
      source: 'agent',
      created_at: new Date().toISOString(),
    }

    return {
      data: {
        bookingId: body.booking_id,
        spotsRemaining: body.spots_remaining,
        booking,
      },
      error: null,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { data: null, error: new Error(message) }
  }
}
