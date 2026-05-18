import {
  getSupabaseClient,
  type TeeTimeInsert,
  type TeeTimeRow,
  type TeeTimeUpdate,
} from './supabaseClient.ts'

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

/** Loads all tee times, ordered by date then time. */
export async function listTeeTimes(): Promise<ListTeeTimesResult> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('tee_times')
      .select('*')
      .order('date', { ascending: true })
      .order('time', { ascending: true })

    if (error) {
      return { data: null, error: new Error(error.message) }
    }
    return { data: data ?? [], error: null }
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
