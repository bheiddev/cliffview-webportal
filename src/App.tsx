import { useState } from 'react'
import { HomePage } from './pages/HomePage.tsx'
import { TeeTimesPage } from './pages/TeeTimesPage.tsx'
import { TournamentsPage } from './pages/TournamentsPage.tsx'
import './App.css'

type Page = 'home' | 'tournaments' | 'tee-times'

const subtitles: Record<Page, string> = {
  home: 'Admin portal',
  tournaments: 'Tournaments',
  'tee-times': 'Tee times',
}

function App() {
  const [page, setPage] = useState<Page>('home')

  return (
    <div className="portal">
      <header className="portal-header">
        <h1 className="portal-title">Cliffview</h1>
        <p className="portal-subtitle">{subtitles[page]}</p>
      </header>

      <main className="portal-main">
        {page === 'home' ? (
          <HomePage
            onTournaments={() => setPage('tournaments')}
            onTeeTimes={() => setPage('tee-times')}
          />
        ) : null}
        {page === 'tournaments' ? (
          <TournamentsPage onBack={() => setPage('home')} />
        ) : null}
        {page === 'tee-times' ? (
          <TeeTimesPage onBack={() => setPage('home')} />
        ) : null}
      </main>
    </div>
  )
}

export default App
