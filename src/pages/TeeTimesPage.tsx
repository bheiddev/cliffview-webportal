import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { TeeTimeInsert, TeeTimeRow } from '../services/supabaseClient.ts'
import {
  createTeeTime,
  deleteTeeTime,
  listTeeTimes,
  updateTeeTime,
} from '../services/teeTimesService.ts'
import {
  FUTURE_DATETIME_MESSAGE,
  isFutureDateTime,
  isFutureTeeTime,
  localDateString,
  minTimeForDate,
} from '../utils/datetime.ts'
import { formatDate, formatTime, money, toTimeInputValue } from '../utils/format.ts'

type TeeTimesPageProps = {
  onBack: () => void
}

const defaultForm = (): TeeTimeInsert => ({
  date: '',
  time: '08:00',
  price: 0,
  spots_total: 4,
  spots_remaining: 4,
  holes: 18,
  is_available: true,
  description: '',
})

type EditDraft = {
  date: string
  time: string
  price: number
  spots_total: number
  spots_remaining: number
  holes: 9 | 18
  is_available: boolean
  description: string
}

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
  const [teeTimes, setTeeTimes] = useState<TeeTimeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<TeeTimeInsert>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await listTeeTimes()
    if (result.error) {
      setTeeTimes([])
      setError(result.error.message)
    } else {
      setTeeTimes(result.data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

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

    if (isFutureTeeTime(result.data)) {
      setTeeTimes((prev) =>
        [...prev, result.data].sort(
          (a, b) =>
            a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
        ),
      )
    }
    setForm(defaultForm())
    setShowCreate(false)
  }

  function startEdit(row: TeeTimeRow) {
    setEditingId(row.id)
    setEditDraft(rowToDraft(row))
    setRowError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft(null)
    setRowError(null)
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
        .filter(isFutureTeeTime)
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
        ),
    )
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
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            setShowCreate((v) => !v)
            setFormError(null)
          }}
        >
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
                value={form.holes ?? 18}
                onChange={(e) =>
                  setForm({
                    ...form,
                    holes: Number(e.target.value) as 9 | 18,
                  })
                }
              >
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
          <span className="portal-count">{teeTimes.length}</span>
        </div>
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
          <p className="portal-empty">No upcoming tee times.</p>
        ) : null}
        {teeTimes.length > 0 ? (
          <div className="portal-table-wrap">
            <table className="portal-table portal-table--actions">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Time</th>
                  <th scope="col">Holes</th>
                  <th scope="col">Price</th>
                  <th scope="col">Spots</th>
                  <th scope="col">Available</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {teeTimes.map((row) => {
                  const isEditing = editingId === row.id
                  const isBusy = busyId === row.id
                  const label = `${formatDate(row.date)} ${formatTime(row.time)}`

                  if (isEditing && editDraft) {
                    return (
                      <tr key={row.id} className="portal-table-row--edit">
                        <td>
                          <input
                            type="date"
                            className="inline-input"
                            min={localDateString()}
                            value={editDraft.date}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                date: e.target.value,
                              })
                            }
                          />
                        </td>
                        <td>
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
                        </td>
                        <td>
                          <select
                            className="inline-input"
                            value={editDraft.holes}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                holes: Number(e.target.value) as 9 | 18,
                              })
                            }
                          >
                            <option value={9}>9</option>
                            <option value={18}>18</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            className="inline-input inline-input--narrow"
                            value={editDraft.price}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                price: Number(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td>
                          <span className="inline-spots">
                            <input
                              type="number"
                              min={0}
                              className="inline-input inline-input--narrow"
                              value={editDraft.spots_remaining}
                              onChange={(e) =>
                                setEditDraft({
                                  ...editDraft,
                                  spots_remaining: Number(e.target.value),
                                })
                              }
                              aria-label="Spots remaining"
                            />
                            <span>/</span>
                            <input
                              type="number"
                              min={1}
                              className="inline-input inline-input--narrow"
                              value={editDraft.spots_total}
                              onChange={(e) =>
                                setEditDraft({
                                  ...editDraft,
                                  spots_total: Number(e.target.value),
                                })
                              }
                              aria-label="Spots total"
                            />
                          </span>
                        </td>
                        <td>
                          <label className="inline-check">
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
                            <span>Yes</span>
                          </label>
                        </td>
                        <td>
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
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={row.id}>
                      <td>{formatDate(row.date)}</td>
                      <td>{formatTime(row.time)}</td>
                      <td>{row.holes}</td>
                      <td>{money.format(row.price)}</td>
                      <td>
                        {row.spots_remaining}/{row.spots_total}
                      </td>
                      <td>
                        {row.is_available ? (
                          <span className="portal-badge portal-badge--open">
                            yes
                          </span>
                        ) : (
                          <span className="portal-badge portal-badge--closed">
                            no
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn--sm btn--ghost"
                            disabled={isBusy || editingId !== null}
                            onClick={() => startEdit(row)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn--sm btn--danger"
                            disabled={isBusy || editingId !== null}
                            onClick={() => void handleDelete(row.id, label)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </>
  )
}
