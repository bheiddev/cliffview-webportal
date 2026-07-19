import {
  getSupabaseClient,
  type PaymentStatus,
  type TeeTimeBookingRow,
} from './supabaseClient.ts'

export type AgentBookingInput = {
  guestName: string
  phone: string
  email?: string
  golfers: number
}

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

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
        'id, tee_time_id, guest_name, phone, email, golfers, status, payment_status, paid_at, created_at',
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
  const email = input.email?.trim() ?? ''

  if (!guestName) {
    return { data: null, error: new Error('Guest name is required.') }
  }
  if (!phone) {
    return { data: null, error: new Error('Phone number is required.') }
  }
  if (email && !EMAIL_PATTERN.test(email)) {
    return { data: null, error: new Error('Email address is invalid.') }
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
      p_email: email || null,
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
      email: email || null,
      golfers: input.golfers,
      status: 'confirmed',
      payment_status: 'unpaid',
      paid_at: null,
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

export type SetPaymentStatusResult =
  | { data: { paymentStatus: PaymentStatus; paidAt: string | null }; error: null }
  | { data: null; error: Error }

export async function setBookingPaymentStatus(
  bookingId: string,
  paid: boolean,
): Promise<SetPaymentStatusResult> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('set_booking_payment_status', {
      p_booking_id: bookingId,
      p_paid: paid,
    })

    if (error) {
      return { data: null, error: new Error(error.message) }
    }

    const body = data as {
      payment_status?: PaymentStatus
      paid_at?: string | null
    } | null

    if (!body?.payment_status) {
      return {
        data: null,
        error: new Error('Update succeeded but the response was incomplete.'),
      }
    }

    return {
      data: { paymentStatus: body.payment_status, paidAt: body.paid_at ?? null },
      error: null,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { data: null, error: new Error(message) }
  }
}

export type CancelBookingResult =
  | { data: { teeTimeId: string; spotsRemaining: number }; error: null }
  | { data: null; error: Error }

export async function cancelTeeTimeBooking(
  bookingId: string,
): Promise<CancelBookingResult> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('cancel_tee_time_booking', {
      p_booking_id: bookingId,
    })

    if (error) {
      return { data: null, error: new Error(error.message) }
    }

    const body = data as {
      tee_time_id?: string
      spots_remaining?: number
    } | null

    if (!body?.tee_time_id || body.spots_remaining === undefined) {
      return {
        data: null,
        error: new Error('Cancel succeeded but the response was incomplete.'),
      }
    }

    return {
      data: { teeTimeId: body.tee_time_id, spotsRemaining: body.spots_remaining },
      error: null,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { data: null, error: new Error(message) }
  }
}

export type MoveBookingResult =
  | {
      data: {
        oldTeeTimeId: string
        newTeeTimeId: string
        oldSpotsRemaining: number
        newSpotsRemaining: number
      }
      error: null
    }
  | { data: null; error: Error }

export async function moveTeeTimeBooking(
  bookingId: string,
  newTeeTimeId: string,
): Promise<MoveBookingResult> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('move_tee_time_booking', {
      p_booking_id: bookingId,
      p_new_tee_time_id: newTeeTimeId,
    })

    if (error) {
      return { data: null, error: new Error(error.message) }
    }

    const body = data as {
      old_tee_time_id?: string
      new_tee_time_id?: string
      old_spots_remaining?: number
      new_spots_remaining?: number
    } | null

    if (
      !body?.old_tee_time_id ||
      !body.new_tee_time_id ||
      body.old_spots_remaining === undefined ||
      body.new_spots_remaining === undefined
    ) {
      return {
        data: null,
        error: new Error('Move succeeded but the response was incomplete.'),
      }
    }

    return {
      data: {
        oldTeeTimeId: body.old_tee_time_id,
        newTeeTimeId: body.new_tee_time_id,
        oldSpotsRemaining: body.old_spots_remaining,
        newSpotsRemaining: body.new_spots_remaining,
      },
      error: null,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { data: null, error: new Error(message) }
  }
}

export type UpdateBookingContactResult =
  | {
      data: {
        guestName: string
        phone: string
        email: string | null
        golfers: number
        teeTimeId: string
        spotsRemaining: number
      }
      error: null
    }
  | { data: null; error: Error }

export async function updateBookingContact(
  bookingId: string,
  input: {
    guestName: string
    phone: string
    email?: string
    golfers: number
  },
): Promise<UpdateBookingContactResult> {
  const guestName = input.guestName.trim()
  const phone = input.phone.trim()
  const email = input.email?.trim() ?? ''
  const golfers = Math.trunc(input.golfers)

  if (!guestName) {
    return { data: null, error: new Error('Guest name is required.') }
  }
  if (!phone) {
    return { data: null, error: new Error('Phone number is required.') }
  }
  if (email && !EMAIL_PATTERN.test(email)) {
    return { data: null, error: new Error('Email address is invalid.') }
  }
  if (!Number.isFinite(golfers) || golfers < 1) {
    return { data: null, error: new Error('Number of golfers must be at least 1.') }
  }

  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.rpc('update_booking_contact', {
      p_booking_id: bookingId,
      p_guest_name: guestName,
      p_phone: phone,
      p_email: email || null,
      p_golfers: golfers,
    })

    if (error) {
      return { data: null, error: new Error(error.message) }
    }

    const body = data as {
      guest_name?: string
      phone?: string
      email?: string | null
      golfers?: number
      tee_time_id?: string
      spots_remaining?: number
    } | null

    if (
      !body?.guest_name ||
      !body.phone ||
      typeof body.golfers !== 'number' ||
      !body.tee_time_id ||
      typeof body.spots_remaining !== 'number'
    ) {
      return {
        data: null,
        error: new Error('Update succeeded but the response was incomplete.'),
      }
    }

    return {
      data: {
        guestName: body.guest_name,
        phone: body.phone,
        email: body.email ?? null,
        golfers: body.golfers,
        teeTimeId: body.tee_time_id,
        spotsRemaining: body.spots_remaining,
      },
      error: null,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { data: null, error: new Error(message) }
  }
}
