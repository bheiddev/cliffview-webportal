import { useState } from 'react'
import { HomePage } from './pages/HomePage.tsx'
import { TeeTimesPage } from './pages/TeeTimesPage.tsx'
import { TournamentsPage } from './pages/TournamentsPage.tsx'
import './App.css'

type Page = 'home' | 'tournaments' | 'tee-times'

function App() {
  const [page, setPage] = useState<Page>('home')

  return (
    <div className="portal">
      <header className="portal-header">
        {page !== 'home' ? (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setPage('home')}
          >
            ← Home
          </button>
        ) : null}
        <img
          className="portal-logo"
          src="/CliffViewLogo.webp"
          alt="Cliffview logo"
        />
      </header>

      <main className="portal-main">
        {page === 'home' ? (
          <HomePage
            onTournaments={() => setPage('tournaments')}
            onTeeTimes={() => setPage('tee-times')}
          />
        ) : null}
        {page === 'tournaments' ? <TournamentsPage /> : null}
        {page === 'tee-times' ? <TeeTimesPage /> : null}
      </main>
    </div>
  )
}

export default App
