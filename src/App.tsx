import { useEffect, useState } from 'react'
import type { TeeTimeRow, TournamentRow } from './services/supabaseClient.ts'
import { listTeeTimes } from './services/teeTimesService.ts'
import { listTournaments } from './services/tournamentsService.ts'
import './App.css'

const money = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

function formatDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`)
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

function formatTime(isoTime: string): string {
  const [hRaw, mRaw] = isoTime.split(':')
  const h = Number(hRaw)
  const m = mRaw?.slice(0, 2) ?? '00'
  if (!Number.isFinite(h)) return isoTime
  const am = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m.padStart(2, '0')} ${am}`
}

function App() {
  const [teeTimes, setTeeTimes] = useState<TeeTimeRow[]>([])
  const [tournaments, setTournaments] = useState<TournamentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [teeTimesError, setTeeTimesError] = useState<string | null>(null)
  const [tournamentsError, setTournamentsError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setTeeTimesError(null)
      setTournamentsError(null)

      const [tt, tr] = await Promise.all([listTeeTimes(), listTournaments()])
      if (cancelled) return

      if (tt.error) {
        setTeeTimes([])
        setTeeTimesError(tt.error.message)
      } else {
        setTeeTimes(tt.data)
      }

      if (tr.error) {
        setTournaments([])
        setTournamentsError(tr.error.message)
      } else {
        setTournaments(tr.data)
      }

      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="portal">
      <header className="portal-header">
        <h1 className="portal-title">Cliffview</h1>
        <p className="portal-subtitle">Tournaments and tee times</p>
      </header>

      <main className="portal-main">
        {loading ? (
          <p className="portal-status" role="status">
            Loading…
          </p>
        ) : null}

        <div className="portal-grid">
          <section className="portal-panel" aria-labelledby="tournaments-heading">
            <div className="portal-panel-head">
              <h2 id="tournaments-heading">Tournaments</h2>
              <span className="portal-count">{tournaments.length}</span>
            </div>
            {tournamentsError ? (
              <p className="portal-error" role="alert">
                {tournamentsError}
              </p>
            ) : null}
            {!loading && !tournamentsError && tournaments.length === 0 ? (
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

          <section className="portal-panel" aria-labelledby="tee-times-heading">
            <div className="portal-panel-head">
              <h2 id="tee-times-heading">Tee times</h2>
              <span className="portal-count">{teeTimes.length}</span>
            </div>
            {teeTimesError ? (
              <p className="portal-error" role="alert">
                {teeTimesError}
              </p>
            ) : null}
            {!loading && !teeTimesError && teeTimes.length === 0 ? (
              <p className="portal-empty">No tee times yet.</p>
            ) : null}
            {teeTimes.length > 0 ? (
              <div className="portal-table-wrap">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Time</th>
                      <th scope="col">Holes</th>
                      <th scope="col">Price</th>
                      <th scope="col">Spots</th>
                      <th scope="col">Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teeTimes.map((row) => (
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  )
}

export default App
