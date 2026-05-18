export const money = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export function formatDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`)
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

export function formatTime(isoTime: string): string {
  const [hRaw, mRaw] = isoTime.split(':')
  const h = Number(hRaw)
  const m = mRaw?.slice(0, 2) ?? '00'
  if (!Number.isFinite(h)) return isoTime
  const am = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m.padStart(2, '0')} ${am}`
}

/** Normalizes DB time (`HH:MM:SS`) to `HH:MM` for `<input type="time">`. */
export function toTimeInputValue(isoTime: string): string {
  const [h, m] = isoTime.split(':')
  if (!h || !m) return isoTime
  return `${h.padStart(2, '0')}:${m.slice(0, 2)}`
}
