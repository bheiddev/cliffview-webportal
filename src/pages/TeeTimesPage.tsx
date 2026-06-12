import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type {
  TeeTimeBookingRow,
  TeeTimeInsert,
  TeeTimeRow,
} from '../services/supabaseClient.ts'
import {
  bookTeeTimeForGuest,
  listTeeTimeBookings,
} from '../services/bookingsService.ts'
import {
  createTeeTime,
  deleteTeeTime,
  findFirstTeeTimeDate,
  listTeeTimesInRange,
  updateTeeTime,
} from '../services/teeTimesService.ts'
import { formatBookingPartyLabel } from '../utils/bookings.ts'
import {
  addDays,
  compareISODate,
  dayRange,
  DAYS_PER_TAB_PAGE,
  formatDayTabLabel,
  FUTURE_DATETIME_MESSAGE,
  isFutureDateTime,
  localDateString,
  minTimeForDate,
} from '../utils/datetime.ts'
import { formatDate, formatTime, money, toTimeInputValue } from '../utils/format.ts'

type TeeTimesPageProps = {
  onBack: () => void
}

const defaultForm = (date = ''): TeeTimeInsert => ({
  date,
  time: '08:00',
  price: 0,
  spots_total: 4,
  spots_remaining: 4,
  holes: null,
  is_available: true,
  description: '',
})

type EditDraft = {
  date: string
  time: string
  price: number
  spots_total: number
  spots_remaining: number
  holes: 9 | 18 | null
  is_available: boolean
  description: string
}

type BookDraft = {
  guestName: string
  phone: string
  golfers: number
}

const defaultBookForm = (maxGolfers = 1): BookDraft => ({
  guestName: '',
  phone: '',
  golfers: Math.max(1, maxGolfers > 0 ? 1 : 0),
})

function rowToDraft(row: TeeTimeRow): EditDraft {
  return {
    date: row.date,
    time: toTimeInputValue(row.time),
    price: row.price,
    spots_total: row.spots_total,
    spots_remaining: row.spots_remaining,
    holes: row.holes,
    is_available: row.is_available,
    description: row.description ?? '',
  }
}

export function TeeTimesPage({ onBack }: TeeTimesPageProps) {
  const today = localDateString()
  const [teeTimes, setTeeTimes] = useState<TeeTimeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<TeeTimeInsert>(() => defaultForm())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bookings, setBookings] = useState<TeeTimeBookingRow[]>([])
  const [bookingTeeTimeId, setBookingTeeTimeId] = useState<string | null>(null)
  const [bookForm, setBookForm] = useState<BookDraft>(defaultBookForm())
  const [bookError, setBookError] = useState<string | null>(null)
  const [bookSaving, setBookSaving] = useState(false)
  const [selectedDate, setSelectedDate] = useState(today)
  const [windowStart, setWindowStart] = useState(today)
  const [hasAlignedInitialDate, setHasAlignedInitialDate] = useState(false)

  const tabDates = useMemo(() => dayRange(windowStart), [windowStart])
  const rangeEnd = tabDates[tabDates.length - 1] ?? windowStart
  const canPagePrev = compareISODate(windowStart, today) > 0

  const countsByDate = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of teeTimes) {
      counts.set(row.date, (counts.get(row.date) ?? 0) + 1)
    }
    return counts
  }, [teeTimes])

  const dayTeeTimes = useMemo(
    () =>
      teeTimes
        .filter((row) => row.date === selectedDate)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [teeTimes, selectedDate],
  )

  const bookingsByTeeTimeId = useMemo(() => {
    const map = new Map<string, TeeTimeBookingRow[]>()
    for (const booking of bookings) {
      const list = map.get(booking.tee_time_id) ?? []
      list.push(booking)
      map.set(booking.tee_time_id, list)
    }
    return map
  }, [bookings])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await listTeeTimesInRange(windowStart, rangeEnd)
    if (result.error) {
      setTeeTimes([])
      setBookings([])
      setError(result.error.message)
    } else {
      setTeeTimes(result.data)
      const bookingsResult = await listTeeTimeBookings(
        result.data.map((row) => row.id),
      )
      setBookings(bookingsResult.error ? [] : bookingsResult.data)
    }
    setLoading(false)
  }, [windowStart, rangeEnd])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (loading || error || hasAlignedInitialDate) return

    void (async () => {
      const selectedHasData = teeTimes.some((row) => row.date === selectedDate)

      if (teeTimes.length === 0) {
        const firstDate = await findFirstTeeTimeDate(today)
        if (firstDate && firstDate !== windowStart) {
          setSelectedDate(firstDate)
          setWindowStart(firstDate)
          return
        }
      } else if (!selectedHasData) {
        const dates = [...new Set(teeTimes.map((row) => row.date))].sort()
        const target =
          dates.find((date) => compareISODate(date, today) >= 0) ?? dates[0]
        if (target) {
          setSelectedDate(target)
          setWindowStart(target)
          return
        }
      }

      setHasAlignedInitialDate(true)
    })()
  }, [loading, error, teeTimes, selectedDate, today, windowStart, hasAlignedInitialDate])

  function shiftTabWindow(direction: -1 | 1) {
    const nextStart = addDays(windowStart, direction * DAYS_PER_TAB_PAGE)
    const clampedStart =
      direction < 0 && compareISODate(nextStart, today) < 0 ? today : nextStart
    const nextTabs = dayRange(clampedStart)

    setWindowStart(clampedStart)
    if (!nextTabs.includes(selectedDate)) {
      setSelectedDate(nextTabs[0])
    }
  }

  function openCreateForm() {
    setShowCreate((open) => {
      const next = !open
      if (next) {
        setForm(defaultForm(selectedDate))
        setFormError(null)
      }
      return next
    })
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)

    if (!isFutureDateTime(form.date, form.time)) {
      setFormError(FUTURE_DATETIME_MESSAGE)
      setSaving(false)
      return
    }

    const payload: TeeTimeInsert = {
      ...form,
      description: form.description?.trim() || null,
    }

    const result = await createTeeTime(payload)
    setSaving(false)

    if (result.error) {
      setFormError(result.error.message)
      return
    }

    setTeeTimes((prev) =>
      [...prev, result.data].sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
      ),
    )
    setSelectedDate(result.data.date)
    if (!tabDates.includes(result.data.date)) {
      setWindowStart(result.data.date)
    }
    setForm(defaultForm(selectedDate))
    setShowCreate(false)
  }

  function startEdit(row: TeeTimeRow) {
    setEditingId(row.id)
    setEditDraft(rowToDraft(row))
    setRowError(null)
    cancelBook()
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft(null)
    setRowError(null)
  }

  function startBook(row: TeeTimeRow) {
    setBookingTeeTimeId(row.id)
    setBookForm(defaultBookForm(row.spots_remaining))
    setBookError(null)
    cancelEdit()
  }

  function cancelBook() {
    setBookingTeeTimeId(null)
    setBookError(null)
  }

  async function handleBook(e: FormEvent, row: TeeTimeRow) {
    e.preventDefault()
    setBookSaving(true)
    setBookError(null)

    const golfers = Math.min(
      Math.max(1, bookForm.golfers),
      row.spots_remaining,
    )

    const result = await bookTeeTimeForGuest(row.id, {
      guestName: bookForm.guestName,
      phone: bookForm.phone,
      golfers,
    })

    setBookSaving(false)

    if (result.error) {
      setBookError(result.error.message)
      return
    }

    setTeeTimes((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? { ...r, spots_remaining: result.data.spotsRemaining }
          : r,
      ),
    )
    setBookings((prev) => [...prev, result.data.booking])
    cancelBook()
  }

  async function saveEdit(id: string) {
    if (!editDraft) return

    if (!isFutureDateTime(editDraft.date, editDraft.time)) {
      setRowError(FUTURE_DATETIME_MESSAGE)
      return
    }

    setBusyId(id)
    setRowError(null)

    const result = await updateTeeTime(id, {
      date: editDraft.date,
      time: editDraft.time,
      price: editDraft.price,
      spots_total: editDraft.spots_total,
      spots_remaining: editDraft.spots_remaining,
      holes: editDraft.holes,
      is_available: editDraft.is_available,
      description: editDraft.description.trim() || null,
    })

    setBusyId(null)

    if (result.error) {
      setRowError(result.error.message)
      return
    }

    setTeeTimes((prev) =>
      prev
        .map((r) => (r.id === id ? result.data : r))
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
        ),
    )

    if (result.data.date !== selectedDate) {
      setSelectedDate(result.data.date)
      if (!tabDates.includes(result.data.date)) {
        setWindowStart(result.data.date)
      }
    }

    cancelEdit()
  }

  async function handleDelete(id: string, label: string) {
    if (!window.confirm(`Delete tee time on ${label}?`)) return

    setBusyId(id)
    setRowError(null)

    const result = await deleteTeeTime(id)
    setBusyId(null)

    if (result.error) {
      setRowError(result.error.message)
      return
    }

    setTeeTimes((prev) => prev.filter((r) => r.id !== id))
    if (editingId === id) cancelEdit()
  }

  return (
    <>
      <div className="page-toolbar">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          ← Home
        </button>
        <button type="button" className="btn btn--primary" onClick={openCreateForm}>
          {showCreate ? 'Cancel' : 'Create tee time'}
        </button>
      </div>

      {showCreate ? (
        <form className="create-form" onSubmit={handleCreate}>
          <h3 className="create-form-title">New tee time</h3>
          {formError ? (
            <p className="portal-error" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="create-form-grid">
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                required
                min={localDateString()}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Time</span>
              <input
                type="time"
                required
                min={minTimeForDate(form.date)}
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Holes</span>
              <select
                value={form.holes ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    holes: e.target.value
                      ? (Number(e.target.value) as 9 | 18)
                      : null,
                  })
                }
              >
                <option value="">—</option>
                <option value={9}>9</option>
                <option value={18}>18</option>
              </select>
            </label>
            <label className="field">
              <span>Price</span>
              <input
                type="number"
                min={0}
                required
                value={form.price}
                onChange={(e) =>
                  setForm({ ...form, price: Number(e.target.value) })
                }
              />
            </label>
            <label className="field">
              <span>Total spots</span>
              <input
                type="number"
                min={1}
                required
                value={form.spots_total}
                onChange={(e) => {
                  const spots = Number(e.target.value)
                  setForm({
                    ...form,
                    spots_total: spots,
                    spots_remaining: spots,
                  })
                }}
              />
            </label>
            <label className="field">
              <span>Spots remaining</span>
              <input
                type="number"
                min={0}
                required
                value={form.spots_remaining}
                onChange={(e) =>
                  setForm({
                    ...form,
                    spots_remaining: Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="field field--checkbox">
              <input
                type="checkbox"
                checked={form.is_available ?? true}
                onChange={(e) =>
                  setForm({ ...form, is_available: e.target.checked })
                }
              />
              <span>Available</span>
            </label>
            <label className="field field--wide">
              <span>Description</span>
              <input
                value={form.description ?? ''}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Optional"
              />
            </label>
          </div>
          <div className="create-form-actions">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save tee time'}
            </button>
          </div>
        </form>
      ) : null}

      <section className="portal-panel" aria-labelledby="tee-times-heading">
        <div className="portal-panel-head">
          <h2 id="tee-times-heading">Tee times</h2>
          <span className="portal-count">{dayTeeTimes.length}</span>
        </div>

        <div className="day-tabs" role="tablist" aria-label="Tee time dates">
          <button
            type="button"
            className="day-tabs__nav"
            onClick={() => shiftTabWindow(-1)}
            disabled={!canPagePrev}
            aria-label="Previous 7 days"
          >
            ‹
          </button>
          <div className="day-tabs__track">
            {tabDates.map((date) => {
              const label = formatDayTabLabel(date, today)
              const count = countsByDate.get(date) ?? 0
              const isSelected = date === selectedDate

              return (
                <button
                  key={date}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`day-tab${isSelected ? ' day-tab--active' : ''}${label.isToday ? ' day-tab--today' : ''}`}
                  onClick={() => setSelectedDate(date)}
                >
                  <span className="day-tab__primary">{label.primary}</span>
                  <span className="day-tab__secondary">{label.secondary}</span>
                  {count > 0 ? (
                    <span className="day-tab__count">{count}</span>
                  ) : null}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            className="day-tabs__nav"
            onClick={() => shiftTabWindow(1)}
            aria-label="Next 7 days"
          >
            ›
          </button>
        </div>

        <p className="day-tabs__summary">{formatDate(selectedDate)}</p>

        {error ? (
          <p className="portal-error" role="alert">
            {error}
          </p>
        ) : null}
        {rowError ? (
          <p className="portal-error" role="alert">
            {rowError}
          </p>
        ) : null}
        {loading ? (
          <p className="portal-status" role="status">
            Loading…
          </p>
        ) : null}
        {!loading && !error && teeTimes.length === 0 ? (
          <p className="portal-empty">
            No tee times from today onward. Check Supabase RLS allows{' '}
            <code>SELECT</code> for the anon key, or run the seed script.
          </p>
        ) : null}
        {!loading && !error && teeTimes.length > 0 && dayTeeTimes.length === 0 ? (
          <p className="portal-empty">
            No tee times on this day. Use the date tabs or › to browse other
            days.
          </p>
        ) : null}
        {!loading && !error && dayTeeTimes.length > 0 ? (
          <div className="tee-time-grid" role="tabpanel">
            {dayTeeTimes.map((row) => {
              const isEditing = editingId === row.id
              const isBooking = bookingTeeTimeId === row.id
              const isBusy = busyId === row.id
              const label = `${formatDate(row.date)} ${formatTime(row.time)}`
              const slotBookings = bookingsByTeeTimeId.get(row.id) ?? []
              const canBook =
                row.spots_remaining > 0 &&
                row.is_available &&
                !isEditing &&
                !isBooking

              if (isBooking) {
                return (
                  <article
                    key={row.id}
                    className="tee-time-card tee-time-card--book"
                  >
                    <h3 className="tee-time-card__time">
                      Book {formatTime(row.time)}
                    </h3>
                    <p className="tee-time-card__spots">
                      {row.spots_remaining} of {row.spots_total} spots left
                    </p>
                    <form
                      className="tee-time-card__book-form"
                      onSubmit={(e) => void handleBook(e, row)}
                    >
                      {bookError ? (
                        <p className="portal-error" role="alert">
                          {bookError}
                        </p>
                      ) : null}
                      <label className="field">
                        <span>Guest name</span>
                        <input
                          required
                          value={bookForm.guestName}
                          onChange={(e) =>
                            setBookForm({
                              ...bookForm,
                              guestName: e.target.value,
                            })
                          }
                          placeholder="Joe Smith"
                        />
                      </label>
                      <label className="field">
                        <span>Phone</span>
                        <input
                          required
                          type="tel"
                          value={bookForm.phone}
                          onChange={(e) =>
                            setBookForm({ ...bookForm, phone: e.target.value })
                          }
                          placeholder="555-123-4567"
                        />
                      </label>
                      <label className="field">
                        <span>Golfers</span>
                        <input
                          required
                          type="number"
                          min={1}
                          max={row.spots_remaining}
                          value={bookForm.golfers}
                          onChange={(e) =>
                            setBookForm({
                              ...bookForm,
                              golfers: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <div className="row-actions">
                        <button
                          type="submit"
                          className="btn btn--sm btn--primary"
                          disabled={bookSaving}
                        >
                          {bookSaving ? 'Booking…' : 'Confirm booking'}
                        </button>
                        <button
                          type="button"
                          className="btn btn--sm btn--ghost"
                          disabled={bookSaving}
                          onClick={cancelBook}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </article>
                )
              }

              if (isEditing && editDraft) {
                return (
                  <article
                    key={row.id}
                    className="tee-time-card tee-time-card--edit"
                  >
                    <h3 className="tee-time-card__time">Edit {formatTime(row.time)}</h3>
                    <div className="tee-time-card__edit-grid">
                      <label className="field">
                        <span>Time</span>
                        <input
                          type="time"
                          className="inline-input"
                          min={minTimeForDate(editDraft.date)}
                          value={editDraft.time}
                          onChange={(e) =>
                            setEditDraft({
                              ...editDraft,
                              time: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Holes</span>
                        <select
                          className="inline-input"
                          value={editDraft.holes ?? ''}
                          onChange={(e) =>
                            setEditDraft({
                              ...editDraft,
                              holes: e.target.value
                                ? (Number(e.target.value) as 9 | 18)
                                : null,
                            })
                          }
                        >
                          <option value="">—</option>
                          <option value={9}>9</option>
                          <option value={18}>18</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Price</span>
                        <input
                          type="number"
                          min={0}
                          className="inline-input"
                          value={editDraft.price}
                          onChange={(e) =>
                            setEditDraft({
                              ...editDraft,
                              price: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Spots remaining</span>
                        <input
                          type="number"
                          min={0}
                          className="inline-input"
                          value={editDraft.spots_remaining}
                          onChange={(e) =>
                            setEditDraft({
                              ...editDraft,
                              spots_remaining: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Total spots</span>
                        <input
                          type="number"
                          min={1}
                          className="inline-input"
                          value={editDraft.spots_total}
                          onChange={(e) =>
                            setEditDraft({
                              ...editDraft,
                              spots_total: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="field field--checkbox">
                        <input
                          type="checkbox"
                          checked={editDraft.is_available}
                          onChange={(e) =>
                            setEditDraft({
                              ...editDraft,
                              is_available: e.target.checked,
                            })
                          }
                        />
                        <span>Available</span>
                      </label>
                    </div>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn btn--sm btn--primary"
                        disabled={isBusy}
                        onClick={() => void saveEdit(row.id)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm btn--ghost"
                        disabled={isBusy}
                        onClick={cancelEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  </article>
                )
              }

              return (
                <article key={row.id} className="tee-time-card">
                  <div className="tee-time-card__head">
                    <h3 className="tee-time-card__time">{formatTime(row.time)}</h3>
                    <span className="tee-time-card__holes">
                      {row.holes != null ? `${row.holes} holes` : '—'}
                    </span>
                  </div>
                  <p className="tee-time-card__price">{money.format(row.price)}</p>
                  <p className="tee-time-card__spots">
                    {row.spots_remaining}/{row.spots_total} spots
                  </p>
                  <div className="tee-time-card__meta">
                    {row.is_available ? (
                      <span className="portal-badge portal-badge--open">open</span>
                    ) : (
                      <span className="portal-badge portal-badge--closed">closed</span>
                    )}
                    {row.spots_remaining === 0 ? (
                      <span className="portal-badge portal-badge--closed">full</span>
                    ) : null}
                  </div>
                  {row.description ? (
                    <p className="tee-time-card__desc">{row.description}</p>
                  ) : null}
                  {slotBookings.length > 0 ? (
                    <ul className="tee-time-card__bookings">
                      {slotBookings.map((booking) => (
                        <li key={booking.id} className="tee-time-card__booking">
                          <span className="tee-time-card__booking-name">
                            {formatBookingPartyLabel(
                              booking.guest_name,
                              booking.golfers,
                            )}
                          </span>
                          {booking.phone ? (
                            <span className="tee-time-card__booking-phone">
                              {booking.phone}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn--sm btn--primary"
                      disabled={
                        !canBook ||
                        isBusy ||
                        editingId !== null ||
                        bookingTeeTimeId !== null
                      }
                      onClick={() => startBook(row)}
                    >
                      Book
                    </button>
                    <button
                      type="button"
                      className="btn btn--sm btn--ghost"
                      disabled={
                        isBusy || editingId !== null || bookingTeeTimeId !== null
                      }
                      onClick={() => startEdit(row)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn--sm btn--danger"
                      disabled={
                        isBusy || editingId !== null || bookingTeeTimeId !== null
                      }
                      onClick={() => void handleDelete(row.id, label)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : null}
      </section>
    </>
  )
}
