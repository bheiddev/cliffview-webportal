import {
  getSupabaseClient,
  type TournamentInsert,
  type TournamentRow,
  type TournamentUpdate,
} from './supabaseClient.ts'
import {
  FUTURE_DATETIME_MESSAGE,
  isFutureDateTime,
  isFutureTournament,
} from '../utils/datetime.ts'

export type CreateTournamentResult =
  | { data: TournamentRow; error: null }
  | { data: null; error: Error }

export type UpdateTournamentResult =
  | { data: TournamentRow; error: null }
  | { data: null; error: Error }

export type ListTournamentsResult =
  | { data: TournamentRow[]; error: null }
  | { data: null; error: Error }

/** Loads upcoming tournaments (date/time in the future), ordered by date then start time. */
export async function listTournaments(): Promise<ListTournamentsResult> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })

    if (error) {
      return { data: null, error: new Error(error.message) }
    }
    return {
      data: (data ?? []).filter(isFutureTournament),
      error: null,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { data: null, error: new Error(message) }
  }
}

/**
 * Inserts a new tournament (e.g. after an admin “create” form submit).
 */
export async function createTournament(
  input: TournamentInsert,
): Promise<CreateTournamentResult> {
  if (!isFutureDateTime(input.date, input.start_time)) {
    return { data: null, error: new Error(FUTURE_DATETIME_MESSAGE) }
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('tournaments')
    .insert(input)
    .select()
    .single()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }
  return { data, error: null }
}

/**
 * Updates an existing tournament by `id` (e.g. after an “edit” form submit).
 */
export async function updateTournament(
  id: string,
  patch: TournamentUpdate,
): Promise<UpdateTournamentResult> {
  if (
    patch.date !== undefined &&
    patch.start_time !== undefined &&
    !isFutureDateTime(patch.date, patch.start_time)
  ) {
    return { data: null, error: new Error(FUTURE_DATETIME_MESSAGE) }
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('tournaments')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }
  return { data, error: null }
}
