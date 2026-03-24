import { useEffect, useState } from 'react'
import type { Game, IgdbGameDetails } from '../types'
import { getGameDetails } from '../api'
import './GameDetail.css'

type GameDetailProps = {
  game: Game
  onClose: () => void
}

export function GameDetail({ game, onClose }: GameDetailProps) {
  const [details, setDetails] = useState<IgdbGameDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadDetails() {
      if (!game.igdb_id) {
        setIsLoading(false)
        return
      }
      try {
        const data = await getGameDetails(game.igdb_id)
        setDetails(data)
      } catch (error) {
        console.error('Error fetching game details:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadDetails()
  }, [game.igdb_id])

  const artworks = details?.artworks || []
  const screenshots = details?.screenshots || []
  const videos = details?.videos || []
  const developer = details?.developer || 'Desconocido'
  const languages = details?.languages?.length ? details.languages.join(', ') : 'No disponible'
  const multiplayer = details?.multiplayer || 'Single Player'
  const bannerUrl = artworks.length > 0 ? artworks[0] : game.cover_url

  return (
    <div className="detail-view-backdrop">
      <div className="detail-view-container">
        <header className="detail-view-header">
          <div className="header-content">
            <div className="header-left">
              <button className="icon-btn" onClick={onClose}>
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <h1>Detalle del Juego</h1>
            </div>
          </div>
        </header>

        <main className="detail-view-main">
          {/* Hero Section */}
          <section className="hero-section">
            <div className="hero-overlay-top"></div>
            <div className="hero-overlay-side"></div>
            {bannerUrl ? (
              <img className="hero-banner" src={bannerUrl} alt="Banner" />
            ) : (
              <div className="hero-banner-placeholder"></div>
            )}
            
            <div className="hero-content">
              <div className="hero-cover-wrapper">
                {game.cover_url ? (
                  <img className="hero-cover" src={game.cover_url} alt={game.title} />
                ) : (
                  <div className="hero-cover-placeholder">Sin imagen</div>
                )}
              </div>
              <div className="hero-info">
                <div className="hero-tags">
                  <span className="tag-secondary">{game.platform}</span>
                  {game.metacritic ? (
                    <span className="tag-primary">Metacritic: {game.metacritic}</span>
                  ) : null}
                </div>
                <h2 className="hero-title">{game.title}</h2>
                <div className="hero-meta">
                  <span>{developer}</span>
                  <span className="dot-separator"></span>
                  <span>{game.release_year || '-'}</span>
                </div>
              </div>
            </div>
          </section>

          <div className="detail-grid-layout">
            {/* Left Column: Details */}
            <div className="detail-left-col">
              {/* Bento Info Grid */}
              <div className="bento-grid">
                <div className="bento-card">
                  <span className="bento-label">Plataformas</span>
                  <div className="bento-value">
                    {game.platform_logo_url ? (
                      <div className="platform-logos-container-detail">
                        {game.platform_logo_url.split(',').map((url, i) => {
                          const pName = game.platform ? game.platform.split(', ')[i] : '';
                          if (!url) return <span key={i} className="platform-text-fallback-detail">{pName}</span>;
                          return <img key={i} src={url} alt={pName} className="platform-logo-detail" title={pName} />;
                        })}
                      </div>
                    ) : (
                      <span>{game.platform || '-'}</span>
                    )}
                  </div>
                </div>
                <div className="bento-card">
                  <span className="bento-label">Género</span>
                  <div className="bento-value">
                    <span>{game.genre || '-'}</span>
                  </div>
                </div>
                <div className="bento-card">
                  <span className="bento-label">Tu Calificación</span>
                  <div className="bento-value rating-value">
                    <span>{game.rating}/5</span>
                    <div className="stars-display">
                      {[1, 2, 3, 4, 5].map(star => (
                        <span key={star} className={`material-symbols-outlined ${star <= game.rating ? 'active' : ''}`}>
                          star
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Media Gallery */}
              {screenshots.length > 0 && (
                <section className="media-section">
                  <div className="section-header">
                    <h3>Capturas de Pantalla</h3>
                    <span className="scroll-hint">Desliza para ver más</span>
                  </div>
                  <div className="horizontal-scroll">
                    {screenshots.map((url, i) => (
                      <div key={i} className="screenshot-card">
                        <img src={url} alt={`Screenshot ${i + 1}`} loading="lazy" />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Video Gallery */}
              {videos.length > 0 && (
                <section className="media-section">
                  <div className="section-header">
                    <h3>Tráilers y Vídeos</h3>
                  </div>
                  <div className="video-grid">
                    {videos.map((vid, i) => (
                      <div key={vid} className="video-card">
                        <div className="video-thumbnail">
                          <iframe
                            src={`https://www.youtube.com/embed/${vid}`}
                            title={`Video ${i + 1}`}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          ></iframe>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Right Column: Sidebar */}
            <aside className="detail-right-col">
              <div className="meta-info-card">
                {isLoading && <p>Cargando detalles extra...</p>}
                {!isLoading && (
                  <div className="extra-info-list">
                    <div className="info-item">
                      <span className="material-symbols-outlined icon-secondary">person</span>
                      <div className="info-text">
                        <span className="info-label">Multijugador</span>
                        <span className="info-value">{multiplayer}</span>
                      </div>
                    </div>
                    
                    <div className="info-item">
                      <span className="material-symbols-outlined icon-secondary">translate</span>
                      <div className="info-text">
                        <span className="info-label">Idiomas</span>
                        <span className="info-value">{languages}</span>
                      </div>
                    </div>

                    {game.metacritic && (
                      <div className="meta-score-box">
                        <div className="meta-score-number">{game.metacritic}</div>
                        <div className="info-text">
                          <span className="info-label">Metascore</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  )
}
