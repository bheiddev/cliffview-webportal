type HomePageProps = {
  onTournaments: () => void
  onTeeTimes: () => void
}

export function HomePage({ onTournaments, onTeeTimes }: HomePageProps) {
  return (
    <div className="home">
      <p className="home-lead">Choose a section to manage.</p>
      <nav className="home-nav" aria-label="Admin sections">
        <button type="button" className="home-card" onClick={onTournaments}>
          <span className="home-card-title">Tournaments</span>
          <span className="home-card-desc">
            Create and view tournament events
          </span>
        </button>
        <button type="button" className="home-card" onClick={onTeeTimes}>
          <span className="home-card-title">Tee times</span>
          <span className="home-card-desc">
            Create, edit, and remove tee times
          </span>
        </button>
        <button
          type="button"
          className="home-card home-card--disabled"
          disabled
          aria-disabled="true"
          title="Coming soon"
        >
          <span className="home-card-title">Analytics</span>
          <span className="home-card-desc">Reports and insights (coming soon)</span>
        </button>
      </nav>
    </div>
  )
}
