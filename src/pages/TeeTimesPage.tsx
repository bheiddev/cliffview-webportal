import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type {
  TeeTimeBookingRow,
  TeeTimeRow,
} from '../services/supabaseClient.ts'
import {
  bookTeeTimeForGuest,
  cancelTeeTimeBooking,
  listTeeTimeBookings,
  moveTeeTimeBooking,
  setBookingPaymentStatus,
  updateBookingContact,
} from '../services/bookingsService.ts'
import {
  findFirstTeeTimeDate,
  listTeeTimes,
  listTeeTimesInRange,
} from '../services/teeTimesService.ts'
import { formatBookingPartyLabel } from '../utils/bookings.ts'
import {
  addDays,
  compareISODate,
  dayRange,
  DAYS_PER_TAB_PAGE,
  formatDayTabLabel,
  localDateString,
} from '../utils/datetime.ts'
import { formatDate, formatTime } from '../utils/format.ts'

type BookDraft = {
  guestName: string
  phone: string
  email: string
  golfers: number
}

const defaultBookForm = (maxGolfers = 1): BookDraft => ({
  guestName: '',
  phone: '',
  email: '',
  golfers: Math.max(1, maxGolfers > 0 ? 1 : 0),
})

export function TeeTimesPage() {
  const today = localDateString()
  const [teeTimes, setTeeTimes] = useState<TeeTimeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bookings, setBookings] = useState<TeeTimeBookingRow[]>([])
  const [bookingTeeTimeId, setBookingTeeTimeId] = useState<string | null>(null)
  const [bookForm, setBookForm] = useState<BookDraft>(defaultBookForm())
  const [bookError, setBookError] = useState<string | null>(null)
  const [bookSaving, setBookSaving] = useState(false)
  const [payingBookingId, setPayingBookingId] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [bookingsError, setBookingsError] = useState<string | null>(null)
  const [viewingTeeTimeId, setViewingTeeTimeId] = useState<string | null>(null)
  const [moveOptions, setMoveOptions] = useState<TeeTimeRow[]>([])
  const [changingBookingId, setChangingBookingId] = useState<string | null>(null)
  const [moveTargetId, setMoveTargetId] = useState('')
  const [actionBookingId, setActionBookingId] = useState<string | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null)
  const [editContact, setEditContact] = useState({
    guestName: '',
    phone: '',
    email: '',
    golfers: 1,
  })
  const [selectedDate, setSelectedDate] = useState(today)
  const [windowStart, setWindowStart] = useState(today)
  const [hasAlignedInitialDate, setHasAlignedInitialDate] = useState(false)

  const tabDates = useMemo(() => dayRange(windowStart), [windowStart])
  const rangeEnd = tabDates[tabDates.length - 1] ?? windowStart
  const canPagePrev = compareISODate(windowStart, today) > 0

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

  const statusCountsByDate = useMemo(() => {
    const map = new Map<
      string,
      { available: number; partial: number; full: number }
    >()
    for (const row of teeTimes) {
      const counts = map.get(row.date) ?? { available: 0, partial: 0, full: 0 }
      if (row.spots_remaining <= 0) {
        counts.full += 1
      } else if (row.spots_remaining < row.spots_total) {
        counts.partial += 1
      } else {
        counts.available += 1
      }
      map.set(row.date, counts)
    }
    return map
  }, [teeTimes])

  const selectedCounts = statusCountsByDate.get(selectedDate) ?? {
    available: 0,
    partial: 0,
    full: 0,
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setBookingsError(null)
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
      if (bookingsResult.error) {
        setBookings([])
        setBookingsError(
          `Could not load reservations: ${bookingsResult.error.message}`,
        )
      } else {
        setBookings(bookingsResult.data)
      }
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

  function startBook(row: TeeTimeRow) {
    setBookingTeeTimeId(row.id)
    setBookForm(defaultBookForm(row.spots_remaining))
    setBookError(null)
  }

  function openView(row: TeeTimeRow) {
    setViewingTeeTimeId(row.id)
    setPaymentError(null)
    setModalError(null)
    setChangingBookingId(null)
    setMoveTargetId('')
    setEditingBookingId(null)
    void (async () => {
      const result = await listTeeTimes()
      if (!result.error) setMoveOptions(result.data)
    })()
  }

  function closeView() {
    setViewingTeeTimeId(null)
    setPaymentError(null)
    setModalError(null)
    setChangingBookingId(null)
    setMoveTargetId('')
    setEditingBookingId(null)
  }

  function startChange(bookingId: string) {
    setChangingBookingId(bookingId)
    setMoveTargetId('')
    setEditingBookingId(null)
    setModalError(null)
  }

  function cancelChange() {
    setChangingBookingId(null)
    setMoveTargetId('')
  }

  function startEditContact(booking: TeeTimeBookingRow) {
    setEditingBookingId(booking.id)
    setEditContact({
      guestName: booking.guest_name,
      phone: booking.phone ?? '',
      email: booking.email ?? '',
      golfers: booking.golfers,
    })
    setChangingBookingId(null)
    setModalError(null)
  }

  function cancelEditContact() {
    setEditingBookingId(null)
  }

  async function handleSaveContact(booking: TeeTimeBookingRow) {
    setActionBookingId(booking.id)
    setModalError(null)

    const result = await updateBookingContact(booking.id, {
      guestName: editContact.guestName,
      phone: editContact.phone,
      email: editContact.email,
      golfers: editContact.golfers,
    })

    setActionBookingId(null)

    if (result.error) {
      setModalError(result.error.message)
      return
    }

    setTeeTimes((prev) =>
      prev.map((r) =>
        r.id === result.data.teeTimeId
          ? { ...r, spots_remaining: result.data.spotsRemaining }
          : r,
      ),
    )
    setBookings((prev) =>
      prev.map((b) =>
        b.id === booking.id
          ? {
              ...b,
              guest_name: result.data.guestName,
              phone: result.data.phone,
              email: result.data.email,
              golfers: result.data.golfers,
            }
          : b,
      ),
    )
    setEditingBookingId(null)
  }

  async function handleCancelBooking(booking: TeeTimeBookingRow) {
    if (
      !window.confirm(
        `Cancel the reservation for ${booking.guest_name}? This frees up ${booking.golfers} spot(s).`,
      )
    ) {
      return
    }

    setActionBookingId(booking.id)
    setModalError(null)

    const result = await cancelTeeTimeBooking(booking.id)

    setActionBookingId(null)

    if (result.error) {
      setModalError(result.error.message)
      return
    }

    setTeeTimes((prev) =>
      prev.map((r) =>
        r.id === result.data.teeTimeId
          ? { ...r, spots_remaining: result.data.spotsRemaining }
          : r,
      ),
    )
    setBookings((prev) => prev.filter((b) => b.id !== booking.id))
  }

  async function handleMoveBooking(booking: TeeTimeBookingRow) {
    if (!moveTargetId) return

    setActionBookingId(booking.id)
    setModalError(null)

    const result = await moveTeeTimeBooking(booking.id, moveTargetId)

    setActionBookingId(null)

    if (result.error) {
      setModalError(result.error.message)
      return
    }

    const { oldTeeTimeId, newTeeTimeId, oldSpotsRemaining, newSpotsRemaining } =
      result.data

    setTeeTimes((prev) =>
      prev.map((r) => {
        if (r.id === oldTeeTimeId)
          return { ...r, spots_remaining: oldSpotsRemaining }
        if (r.id === newTeeTimeId)
          return { ...r, spots_remaining: newSpotsRemaining }
        return r
      }),
    )
    setBookings((prev) =>
      prev.map((b) =>
        b.id === booking.id ? { ...b, tee_time_id: newTeeTimeId } : b,
      ),
    )
    setChangingBookingId(null)
    setMoveTargetId('')
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
      email: bookForm.email,
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

  async function handleTogglePaid(booking: TeeTimeBookingRow) {
    const nextPaid = booking.payment_status !== 'paid'
    setPayingBookingId(booking.id)
    setPaymentError(null)
    setModalError(null)

    const result = await setBookingPaymentStatus(booking.id, nextPaid)

    setPayingBookingId(null)

    if (result.error) {
      setPaymentError(result.error.message)
      return
    }

    setBookings((prev) =>
      prev.map((b) =>
        b.id === booking.id
          ? {
              ...b,
              payment_status: result.data.paymentStatus,
              paid_at: result.data.paidAt,
            }
          : b,
      ),
    )
  }

  const viewingRow = viewingTeeTimeId
    ? (teeTimes.find((r) => r.id === viewingTeeTimeId) ?? null)
    : null
  const viewingBookings = viewingTeeTimeId
    ? (bookingsByTeeTimeId.get(viewingTeeTimeId) ?? [])
    : []

  return (
    <>
      <section className="portal-panel" aria-labelledby="tee-times-heading">
        <div className="portal-panel-head">
          <h2 id="tee-times-heading">Tee times</h2>
          <div className="portal-panel-head__right">
            <span className="portal-count portal-count--partial">
              {selectedCounts.partial} partial
            </span>
            <span className="portal-count portal-count--full">
              {selectedCounts.full} full
            </span>
            <input
              type="date"
              className="inline-input portal-date-picker"
              aria-label="Jump to date"
              min={today}
              value={selectedDate}
              onChange={(e) => {
                const date = e.target.value
                if (!date) return
                setSelectedDate(date)
                setWindowStart(date)
              }}
            />
          </div>
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
              const isSelected = date === selectedDate
              const counts = statusCountsByDate.get(date)

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
                  {counts ? (
                    <span className="day-tab__counts">
                      {counts.available > 0 ? (
                        <span
                          className="day-tab__count day-tab__count--available"
                          title={`${counts.available} available`}
                        >
                          {counts.available}
                        </span>
                      ) : null}
                      {counts.partial > 0 ? (
                        <span
                          className="day-tab__count day-tab__count--partial"
                          title={`${counts.partial} partially booked`}
                        >
                          {counts.partial}
                        </span>
                      ) : null}
                      {counts.full > 0 ? (
                        <span
                          className="day-tab__count day-tab__count--full"
                          title={`${counts.full} fully booked`}
                        >
                          {counts.full}
                        </span>
                      ) : null}
                    </span>
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

        <div className="day-tabs__summary">
          <span>{formatDate(selectedDate)}</span>
          <span className="day-legend">
            <span className="day-legend__item">
              <span className="day-legend__dot day-legend__dot--available" />
              Available
            </span>
            <span className="day-legend__item">
              <span className="day-legend__dot day-legend__dot--partial" />
              Partially booked
            </span>
            <span className="day-legend__item">
              <span className="day-legend__dot day-legend__dot--full" />
              Fully booked
            </span>
          </span>
        </div>

        {error ? (
          <p className="portal-error" role="alert">
            {error}
          </p>
        ) : null}
        {bookingsError ? (
          <p className="portal-error" role="alert">
            {bookingsError}
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
              const isBooking = bookingTeeTimeId === row.id
              const slotBookings = bookingsByTeeTimeId.get(row.id) ?? []
              const canBook =
                row.spots_remaining > 0 && row.is_available && !isBooking

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
                        <span>Email (optional)</span>
                        <input
                          type="email"
                          value={bookForm.email}
                          onChange={(e) =>
                            setBookForm({ ...bookForm, email: e.target.value })
                          }
                          placeholder="joe@example.com"
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

              const isFull = row.spots_remaining === 0
              const isLow = row.spots_remaining > 0 && row.spots_remaining < 4
              const cardModifier = isFull
                ? ' tee-time-card--full'
                : isLow
                  ? ' tee-time-card--low'
                  : ''

              return (
                <article
                  key={row.id}
                  className={`tee-time-card${cardModifier}`}
                >
                  <div className="tee-time-card__head">
                    <h3 className="tee-time-card__time">{formatTime(row.time)}</h3>
                    <span className="tee-time-card__spots">
                      {row.spots_remaining}/{row.spots_total} spots
                    </span>
                  </div>
                  <div className="tee-time-card__meta">
                    {!row.is_available ? (
                      <span className="portal-badge portal-badge--closed">closed</span>
                    ) : null}
                  </div>
                  {row.description ? (
                    <p className="tee-time-card__desc">{row.description}</p>
                  ) : null}
                  {slotBookings.length > 0 ? (
                    <ul className="tee-time-card__bookings">
                      {slotBookings.map((booking) => {
                        const isPaid = booking.payment_status === 'paid'
                        return (
                          <li
                            key={booking.id}
                            className="tee-time-card__booking"
                          >
                            <span className="tee-time-card__booking-name">
                              {formatBookingPartyLabel(
                                booking.guest_name,
                                booking.golfers,
                              )}
                            </span>
                            <span
                              className={`portal-badge ${
                                isPaid
                                  ? 'portal-badge--open'
                                  : 'portal-badge--unpaid'
                              }`}
                            >
                              {isPaid ? 'Paid' : 'Unpaid'}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn--sm btn--primary"
                      disabled={!canBook || bookingTeeTimeId !== null}
                      onClick={() => startBook(row)}
                    >
                      Book
                    </button>
                    {slotBookings.length > 0 ? (
                      <button
                        type="button"
                        className="btn btn--sm btn--ghost"
                        onClick={() => openView(row)}
                      >
                        View
                      </button>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        ) : null}
      </section>

      {viewingRow ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Reservations"
          onClick={closeView}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-card__head">
              <h3 className="modal-card__title">
                Reservations · {formatTime(viewingRow.time)}
              </h3>
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={closeView}
              >
                Close
              </button>
            </div>
            <p className="modal-card__subtitle">
              {formatDate(viewingRow.date)}
            </p>
            {paymentError ? (
              <p className="portal-error" role="alert">
                {paymentError}
              </p>
            ) : null}
            {modalError ? (
              <p className="portal-error" role="alert">
                {modalError}
              </p>
            ) : null}
            {viewingBookings.length === 0 ? (
              <p className="portal-empty">No reservations on this tee time.</p>
            ) : null}
            <ul className="reservation-list">
              {viewingBookings.map((booking) => {
                const isPaid = booking.payment_status === 'paid'
                const isChanging = changingBookingId === booking.id
                const isEditing = editingBookingId === booking.id
                const isActing = actionBookingId === booking.id
                const changeOptions = moveOptions.filter(
                  (o) =>
                    o.id !== booking.tee_time_id &&
                    o.is_available &&
                    o.spots_remaining >= booking.golfers,
                )
                return (
                  <li key={booking.id} className="reservation">
                    <div className="reservation__row">
                      <div className="reservation__info">
                        <span className="reservation__name">
                          {formatBookingPartyLabel(
                            booking.guest_name,
                            booking.golfers,
                          )}
                        </span>
                        {booking.phone ? (
                          <span className="reservation__detail">
                            {booking.phone}
                          </span>
                        ) : null}
                        {booking.email ? (
                          <span className="reservation__detail">
                            {booking.email}
                          </span>
                        ) : null}
                      </div>
                      <div className="reservation__pay">
                        <span
                          className={`portal-badge ${
                            isPaid
                              ? 'portal-badge--open'
                              : 'portal-badge--unpaid'
                          }`}
                        >
                          {isPaid ? 'Paid' : 'Unpaid'}
                        </span>
                        <button
                          type="button"
                          className="btn btn--sm btn--ghost"
                          disabled={payingBookingId === booking.id}
                          onClick={() => void handleTogglePaid(booking)}
                        >
                          {payingBookingId === booking.id
                            ? 'Saving…'
                            : isPaid
                              ? 'Mark unpaid'
                              : 'Mark paid'}
                        </button>
                      </div>
                    </div>
                    {isEditing ? (
                      <div className="reservation__change">
                        <label className="field">
                          <span>Name</span>
                          <input
                            className="inline-input"
                            type="text"
                            value={editContact.guestName}
                            onChange={(e) =>
                              setEditContact({
                                ...editContact,
                                guestName: e.target.value,
                              })
                            }
                            placeholder="Guest name"
                          />
                        </label>
                        <label className="field">
                          <span>Phone</span>
                          <input
                            className="inline-input"
                            type="tel"
                            value={editContact.phone}
                            onChange={(e) =>
                              setEditContact({
                                ...editContact,
                                phone: e.target.value,
                              })
                            }
                            placeholder="555-123-4567"
                          />
                        </label>
                        <label className="field">
                          <span>Email (optional)</span>
                          <input
                            className="inline-input"
                            type="email"
                            value={editContact.email}
                            onChange={(e) =>
                              setEditContact({
                                ...editContact,
                                email: e.target.value,
                              })
                            }
                            placeholder="joe@example.com"
                          />
                        </label>
                        <label className="field">
                          <span>Golfers</span>
                          <input
                            className="inline-input"
                            type="number"
                            min={1}
                            max={
                              booking.golfers +
                              (viewingRow?.spots_remaining ?? 0)
                            }
                            value={editContact.golfers}
                            onChange={(e) =>
                              setEditContact({
                                ...editContact,
                                golfers: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <div className="reservation__actions">
                          <button
                            type="button"
                            className="btn btn--sm btn--primary"
                            disabled={isActing}
                            onClick={() => void handleSaveContact(booking)}
                          >
                            {isActing ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            className="btn btn--sm btn--ghost"
                            disabled={isActing}
                            onClick={cancelEditContact}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : isChanging ? (
                      <div className="reservation__change">
                        <select
                          className="inline-input"
                          value={moveTargetId}
                          onChange={(e) => setMoveTargetId(e.target.value)}
                        >
                          <option value="">
                            {changeOptions.length > 0
                              ? 'Select a tee time…'
                              : 'No other available tee times'}
                          </option>
                          {changeOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                              {formatDate(o.date)} · {formatTime(o.time)} (
                              {o.spots_remaining} left)
                            </option>
                          ))}
                        </select>
                        <div className="reservation__actions">
                          <button
                            type="button"
                            className="btn btn--sm btn--primary"
                            disabled={!moveTargetId || isActing}
                            onClick={() => void handleMoveBooking(booking)}
                          >
                            {isActing ? 'Moving…' : 'Move'}
                          </button>
                          <button
                            type="button"
                            className="btn btn--sm btn--ghost"
                            disabled={isActing}
                            onClick={cancelChange}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="reservation__actions">
                        <button
                          type="button"
                          className="btn btn--sm btn--ghost"
                          disabled={isActing}
                          onClick={() => startEditContact(booking)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn--sm btn--ghost"
                          disabled={isActing}
                          onClick={() => startChange(booking.id)}
                        >
                          Change Tee Time
                        </button>
                        <button
                          type="button"
                          className="btn btn--sm btn--danger"
                          disabled={isActing}
                          onClick={() => void handleCancelBooking(booking)}
                        >
                          {isActing ? 'Cancelling…' : 'Cancel'}
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  )
}
