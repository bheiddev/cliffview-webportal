import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { TournamentInsert, TournamentRow } from '../services/supabaseClient.ts'
import { createTournament, listTournaments } from '../services/tournamentsService.ts'
import { formatDate, formatTime, money } from '../utils/format.ts'

type TournamentsPageProps = {
  onBack: () => void
}

const defaultForm = (): TournamentInsert => ({
  name: '',
  date: '',
  start_time: '08:00',
  team_size: 4,
  format: '',
  holes: 18,
  entry_fee_guest: 0,
  spots_total: 32,
  spots_remaining: 32,
  status: 'draft',
  is_visible: true,
})

export function TournamentsPage({ onBack }: TournamentsPageProps) {
  const [tournaments, setTournaments] = useState<TournamentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<TournamentInsert>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await listTournaments()
    if (result.error) {
      setTournaments([])
      setError(result.error.message)
    } else {
      setTournaments(result.data)
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

    const payload: TournamentInsert = {
      ...form,
      format: form.format?.trim() || null,
    }

    const result = await createTournament(payload)
    setSaving(false)

    if (result.error) {
      setFormError(result.error.message)
      return
    }

    setTournaments((prev) =>
      [...prev, result.data].sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.start_time.localeCompare(b.start_time),
      ),
    )
    setForm(defaultForm())
    setShowCreate(false)
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
          {showCreate ? 'Cancel' : 'Create tournament'}
        </button>
      </div>

      {showCreate ? (
        <form className="create-form" onSubmit={handleCreate}>
          <h3 className="create-form-title">New tournament</h3>
          {formError ? (
            <p className="portal-error" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="create-form-grid">
            <label className="field">
              <span>Name</span>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Start time</span>
              <input
                type="time"
                required
                value={form.start_time}
                onChange={(e) =>
                  setForm({ ...form, start_time: e.target.value })
                }
              />
            </label>
            <label className="field">
              <span>Team size</span>
              <select
                value={form.team_size}
                onChange={(e) =>
                  setForm({
                    ...form,
                    team_size: Number(e.target.value) as 1 | 2 | 4 | 6,
                  })
                }
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={4}>4</option>
                <option value={6}>6</option>
              </select>
            </label>
            <label className="field">
              <span>Format</span>
              <input
                value={form.format ?? ''}
                onChange={(e) => setForm({ ...form, format: e.target.value })}
                placeholder="e.g. Scramble"
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
              <span>Entry fee (guest)</span>
              <input
                type="number"
                min={0}
                required
                value={form.entry_fee_guest}
                onChange={(e) =>
                  setForm({
                    ...form,
                    entry_fee_guest: Number(e.target.value),
                  })
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
              <span>Status</span>
              <select
                value={form.status ?? 'draft'}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value as TournamentInsert['status'],
                  })
                }
              >
                <option value="draft">Draft</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <label className="field field--checkbox">
              <input
                type="checkbox"
                checked={form.is_visible ?? true}
                onChange={(e) =>
                  setForm({ ...form, is_visible: e.target.checked })
                }
              />
              <span>Visible to members</span>
            </label>
          </div>
          <div className="create-form-actions">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save tournament'}
            </button>
          </div>
        </form>
      ) : null}

      <section className="portal-panel" aria-labelledby="tournaments-heading">
        <div className="portal-panel-head">
          <h2 id="tournaments-heading">Tournaments</h2>
          <span className="portal-count">{tournaments.length}</span>
        </div>
        {error ? (
          <p className="portal-error" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? (
          <p className="portal-status" role="status">
            Loading…
          </p>
        ) : null}
        {!loading && !error && tournaments.length === 0 ? (
          <p className="portal-empty">No tournaments yet.</p>
        ) : null}
        {tournaments.length > 0 ? (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Date</th>
                  <th scope="col">Start</th>
                  <th scope="col">Spots</th>
                  <th scope="col">Entry</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {tournaments.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <span className="portal-cell-title">{t.name}</span>
                      {t.format ? (
                        <span className="portal-cell-meta">{t.format}</span>
                      ) : null}
                    </td>
                    <td>{formatDate(t.date)}</td>
                    <td>{formatTime(t.start_time)}</td>
                    <td>
                      {t.spots_remaining}/{t.spots_total}
                    </td>
                    <td>{money.format(t.entry_fee_guest)}</td>
                    <td>
                      <span
                        className={`portal-badge portal-badge--${t.status}`}
                      >
                        {t.status}
                      </span>
                      {!t.is_visible ? (
                        <span className="portal-badge portal-badge--muted">
                          hidden
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </>
  )
}
