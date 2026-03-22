import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { addGame, getGames, removeGame, searchIgdb } from './api'
import type { Game, IgdbSuggestion, NewGamePayload } from './types'
import { Pagination } from './Pagination'
import logoGv from './assets/logogv.png'
import './App.css'

type FormState = {
  title: string
  platform: string
  rating: number
  cover_url: string
  genre: string
  release_year: string
  metacritic: string
  igdb_id: number | null
}

const initialForm: FormState = {
  title: '',
  platform: '',
  rating: 3,
  cover_url: '',
  genre: '',
  release_year: '',
  metacritic: '',
  igdb_id: null,
}

function App() {
  const [games, setGames] = useState<Game[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [form, setForm] = useState<FormState>(initialForm)
  const [igdbResults, setIgdbResults] = useState<IgdbSuggestion[]>([])
  const [isSearchingIgdb, setIsSearchingIgdb] = useState(false)
  const [igdbError, setIgdbError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  async function loadGames(currentSearch: string) {
    setIsLoading(true)
    try {
      const result = await getGames(currentSearch)
      setGames(result)
      setErrorMessage('')
    } catch (error) {
      setErrorMessage(String(error))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadGames('')
  }, [])

  useEffect(() => {
    setCurrentPage(1)
    const timer = window.setTimeout(() => {
      loadGames(search)
    }, 220)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (!showModal) {
      return
    }
    const term = form.title.trim()
    if (term.length < 2 || form.igdb_id !== null) {
      setIgdbResults([])
      setIgdbError('')
      return
    }

    const timer = window.setTimeout(async () => {
      setIsSearchingIgdb(true)
      setIgdbError('')
      try {
        const results = await searchIgdb(term)
        setIgdbResults(results)
      } catch (error) {
        setIgdbResults([])
        setIgdbError(String(error))
      } finally {
        setIsSearchingIgdb(false)
      }
    }, 350)

    return () => window.clearTimeout(timer)
  }, [form.title, form.igdb_id, showModal])

  const visibleGames = useMemo(() => games, [games])

  const ITEMS_PER_PAGE = 10
  const totalPages = Math.ceil(visibleGames.length / ITEMS_PER_PAGE)

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [totalPages, currentPage])

  const paginatedGames = useMemo(() => {
    return visibleGames.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
  }, [visibleGames, currentPage])

  function applySuggestion(game: IgdbSuggestion) {
    setForm((previous) => ({
      ...previous,
      title: game.title,
      platform: game.platforms.join(', '),
      cover_url: game.cover_url ?? '',
      genre: game.genres.join(', '),
      release_year: game.release_year ? String(game.release_year) : '',
      metacritic: game.metacritic ? String(game.metacritic) : '',
      igdb_id: game.igdb_id,
    }))
    setIgdbResults([])
    setIgdbError('')
  }

  function openModal() {
    setForm(initialForm)
    setIgdbResults([])
    setIgdbError('')
    setShowModal(true)
  }

  function closeDetail() {
    setSelectedGame(null)
  }

  async function submitNewGame(event: FormEvent) {
    event.preventDefault()
    setIsSaving(true)

    const payload: NewGamePayload = {
      title: form.title.trim(),
      platform: form.platform.trim(),
      rating: form.rating,
      cover_url: form.cover_url.trim() || null,
      genre: form.genre.trim() || null,
      release_year: form.release_year ? Number(form.release_year) : null,
      metacritic: form.metacritic ? Number(form.metacritic) : null,
      igdb_id: form.igdb_id,
    }

    try {
      await addGame(payload)
      setShowModal(false)
      await loadGames(search)
    } catch (error) {
      setErrorMessage(String(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: number) {
    try {
      await removeGame(id)
      await loadGames(search)
    } catch (error) {
      setErrorMessage(String(error))
    }
  }

  return (
    <main className="app-shell container-fluid">
      <section className="hero-card">
        <div className="d-flex align-items-center gap-3">
          <img src={logoGv} alt="Game Vault Logo" className="app-logo" />
          <div>
            <h1>Game Vault</h1>
            <p className="subtitle">Lleva control de tus juegos terminados y dales tu rating.</p>
          </div>
        </div>
        <button className="btn btn-accent" onClick={openModal}>
          + Agregar juego
        </button>
      </section>

      <section className="toolbar">
        <input
          className="form-control search-input"
          placeholder="Buscar por nombre o plataforma"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </section>

      {errorMessage ? <div className="alert alert-danger">{errorMessage}</div> : null}

      <section className="table-card">
        <div className="table-responsive game-list-scroll">
          <table className="table table-hover align-middle game-table">
            <thead>
              <tr>
                <th>Carátula</th>
                <th>Juego</th>
                <th>Plataforma</th>
                <th>Género</th>
                <th>Año</th>
                <th>Metacritic</th>
                <th>Calificación</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!isLoading && visibleGames.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-cell">
                    Aún no hay juegos. Agrega el primero con el botón superior.
                  </td>
                </tr>
              ) : null}
              {paginatedGames.map((game) => (
                <tr key={game.id} onClick={() => setSelectedGame(game)} className="game-row">
                  <td>
                    {game.cover_url ? (
                      <img src={game.cover_url} alt={game.title} className="cover-thumb" />
                    ) : (
                      <div className="cover-placeholder">Sin imagen</div>
                    )}
                  </td>
                  <td className="fw-semibold">{game.title}</td>
                  <td>{game.platform || '-'}</td>
                  <td>{game.genre || '-'}</td>
                  <td>{game.release_year || '-'}</td>
                  <td>{game.metacritic || '-'}</td>
                  <td>
                    <Stars value={game.rating} />
                  </td>
                  <td className="text-end">
                    <div className="delete-action">
                      <button
                        className="btn btn-sm btn-delete"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleDelete(game.id)
                        }}
                      >
                        x
                      </button>
                      <span className="delete-tooltip">Eliminar de la lista</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {visibleGames.length > 10 ? (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      ) : null}

      {selectedGame ? (
        <div className="detail-backdrop" onClick={closeDetail}>
          <section className="detail-panel" onClick={(event) => event.stopPropagation()}>
            <button className="btn btn-sm btn-outline-secondary detail-close" onClick={closeDetail}>
              Cerrar
            </button>

            <div className="detail-cover-column">
              {selectedGame.cover_url ? (
                <img src={selectedGame.cover_url} alt={selectedGame.title} className="detail-cover-image" />
              ) : (
                <div className="detail-cover-empty">Sin carátula</div>
              )}
            </div>

            <div className="detail-info-column">
              <h2 className="detail-title">{selectedGame.title}</h2>
              <p className="detail-subtitle">Detalle del juego</p>

              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Plataforma</span>
                  <strong>{selectedGame.platform || '-'}</strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Género</span>
                  <strong>{selectedGame.genre || '-'}</strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Año</span>
                  <strong>{selectedGame.release_year || '-'}</strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Metacritic</span>
                  <strong>{selectedGame.metacritic || '-'}</strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Calificación</span>
                  <strong>
                    <Stars value={selectedGame.rating} />
                  </strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">IGDB ID</span>
                  <strong>{selectedGame.igdb_id || '-'}</strong>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {showModal ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="modal-title">Agregar juego</h2>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => setShowModal(false)}>
                Cerrar
              </button>
            </div>

            <form onSubmit={submitNewGame} className="row g-3">
              <div className="col-12 position-relative">
                <label className="form-label">Nombre del juego</label>
                <input
                  className="form-control"
                  required
                  value={form.title}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, title: event.target.value, igdb_id: null }))
                  }
                />
                {isSearchingIgdb ? <span className="igdb-status">Buscando en IGDB…</span> : null}
                {igdbError ? <div className="igdb-error">{igdbError}</div> : null}
                {igdbResults.length > 0 ? (
                  <div className="igdb-dropdown">
                    {igdbResults.map((result) => (
                      <button
                        key={result.igdb_id}
                        type="button"
                        className="igdb-option"
                        onClick={() => applySuggestion(result)}
                      >
                        <span>{result.title}</span>
                        <small>
                          {result.platforms.slice(0, 2).join(', ')}
                          {result.release_year ? ` · ${result.release_year}` : ''}
                        </small>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="col-md-6">
                <label className="form-label">Plataforma</label>
                <input
                  className="form-control"
                  value={form.platform}
                  onChange={(event) => setForm((prev) => ({ ...prev, platform: event.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Género</label>
                <input
                  className="form-control"
                  value={form.genre}
                  onChange={(event) => setForm((prev) => ({ ...prev, genre: event.target.value }))}
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">Año</label>
                <input
                  className="form-control"
                  type="number"
                  min={1970}
                  max={2100}
                  value={form.release_year}
                  onChange={(event) => setForm((prev) => ({ ...prev, release_year: event.target.value }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Metacritic</label>
                <input
                  className="form-control"
                  type="number"
                  min={0}
                  max={100}
                  value={form.metacritic}
                  onChange={(event) => setForm((prev) => ({ ...prev, metacritic: event.target.value }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Calificación</label>
                <StarPicker
                  value={form.rating}
                  onChange={(value) => setForm((prev) => ({ ...prev, rating: value }))}
                />
              </div>

              <div className="col-12">
                <label className="form-label">URL portada</label>
                <input
                  className="form-control"
                  value={form.cover_url}
                  onChange={(event) => setForm((prev) => ({ ...prev, cover_url: event.target.value }))}
                />
              </div>

              <div className="col-12 d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-accent" disabled={isSaving}>
                  {isSaving ? 'Guardando…' : 'Guardar juego'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function Stars({ value }: { value: number }) {
  return (
    <span className="stars" aria-label={`Calificación ${value} de 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= value ? 'star active' : 'star'}>
          ★
        </span>
      ))}
    </span>
  )
}

function StarPicker({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="star-picker">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          type="button"
          key={star}
          className={star <= value ? 'star-btn active' : 'star-btn'}
          onClick={() => onChange(star)}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export default App
