import { toTimeInputValue } from './format.ts'

export const FUTURE_DATETIME_MESSAGE =
  'Date and time must be in the future.'

/** Local calendar date as `YYYY-MM-DD`. */
export function localDateString(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseLocalDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`)
}

/** Add calendar days to an ISO date string (`YYYY-MM-DD`). */
export function addDays(isoDate: string, days: number): string {
  const d = parseLocalDate(isoDate)
  d.setDate(d.getDate() + days)
  return localDateString(d)
}

export const DAYS_PER_TAB_PAGE = 7

/** Build a consecutive run of ISO dates starting at `startDate`. */
export function dayRange(startDate: string, count = DAYS_PER_TAB_PAGE): string[] {
  return Array.from({ length: count }, (_, i) => addDays(startDate, i))
}

export function compareISODate(a: string, b: string): number {
  return a.localeCompare(b)
}

export type DayTabLabel = {
  primary: string
  secondary: string
  isToday: boolean
}

/** Short labels for horizontal day tabs. */
export function formatDayTabLabel(isoDate: string, today = localDateString()): DayTabLabel {
  const d = parseLocalDate(isoDate)
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(d)
  const monthDay = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(d)

  if (isoDate === today) {
    return { primary: 'Today', secondary: monthDay, isToday: true }
  }

  return { primary: weekday, secondary: monthDay, isToday: false }
}

/** Local time as `HH:MM` for `<input type="time">`. */
export function localTimeInputValue(date = new Date()): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/** Earliest selectable time when `date` is today; otherwise unrestricted. */
export function minTimeForDate(date: string): string | undefined {
  if (date === localDateString()) return localTimeInputValue()
  return undefined
}

export function parseLocalDateTime(date: string, time: string): Date {
  const hhmm = toTimeInputValue(time)
  return new Date(`${date}T${hhmm}:00`)
}

export function isFutureDateTime(date: string, time: string): boolean {
  return parseLocalDateTime(date, time).getTime() > Date.now()
}

export function isFutureTeeTime(row: { date: string; time: string }): boolean {
  return isFutureDateTime(row.date, row.time)
}

export function isFutureTournament(row: {
  date: string
  start_time: string
}): boolean {
  return isFutureDateTime(row.date, row.start_time)
}
