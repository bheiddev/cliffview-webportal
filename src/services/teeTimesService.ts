import {
  getSupabaseClient,
  type TeeTimeInsert,
  type TeeTimeRow,
  type TeeTimeUpdate,
} from './supabaseClient.ts'
import {
  FUTURE_DATETIME_MESSAGE,
  isFutureDateTime,
  localDateString,
} from '../utils/datetime.ts'

export type CreateTeeTimeResult =
  | { data: TeeTimeRow; error: null }
  | { data: null; error: Error }

export type UpdateTeeTimeResult =
  | { data: TeeTimeRow; error: null }
  | { data: null; error: Error }

export type DeleteTeeTimeResult =
  | { error: null }
  | { error: Error }

export type ListTeeTimesResult =
  | { data: TeeTimeRow[]; error: null }
  | { data: null; error: Error }

/** Loads tee times from today forward (all slots per day for admin scheduling). */
export async function listTeeTimes(): Promise<ListTeeTimesResult> {
  return listTeeTimesInRange(localDateString(), '2099-12-31')
}

/** Earliest tee time date on or after `fromDate`, if any. */
export async function findFirstTeeTimeDate(
  fromDate: string,
): Promise<string | null> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('tee_times')
      .select('date')
      .gte('date', fromDate)
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error || !data) return null
    return data.date
  } catch {
    return null
  }
}

/** Loads tee times for an inclusive date range (used by the day-tab grid). */
export async function listTeeTimesInRange(
  startDate: string,
  endDate: string,
): Promise<ListTeeTimesResult> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('tee_times')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('time', { ascending: true })

    if (error) {
      return { data: null, error: new Error(error.message) }
    }
    return {
      data: data ?? [],
      error: null,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { data: null, error: new Error(message) }
  }
}

/**
 * Inserts a new tee time (e.g. after an admin “create” form submit).
 */
export async function createTeeTime(
  input: TeeTimeInsert,
): Promise<CreateTeeTimeResult> {
  if (!isFutureDateTime(input.date, input.time)) {
    return { data: null, error: new Error(FUTURE_DATETIME_MESSAGE) }
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('tee_times')
    .insert(input)
    .select()
    .single()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }
  return { data, error: null }
}

/**
 * Updates an existing tee time by `id` (e.g. after an “edit” form submit).
 */
export async function updateTeeTime(
  id: string,
  patch: TeeTimeUpdate,
): Promise<UpdateTeeTimeResult> {
  if (
    patch.date !== undefined &&
    patch.time !== undefined &&
    !isFutureDateTime(patch.date, patch.time)
  ) {
    return { data: null, error: new Error(FUTURE_DATETIME_MESSAGE) }
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('tee_times')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }
  return { data, error: null }
}

/** Removes a tee time by `id`. */
export async function deleteTeeTime(id: string): Promise<DeleteTeeTimeResult> {
  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('tee_times').delete().eq('id', id)

    if (error) {
      return { error: new Error(error.message) }
    }
    return { error: null }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { error: new Error(message) }
  }
}
