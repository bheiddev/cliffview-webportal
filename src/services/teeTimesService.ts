import {
  getSupabaseClient,
  type TeeTimeRow,
} from './supabaseClient.ts'
import { localDateString } from '../utils/datetime.ts'

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
