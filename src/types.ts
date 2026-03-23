export type Game = {
  id: number
  title: string
  platform: string
  rating: number
  cover_url: string | null
  genre: string | null
  release_year: number | null
  metacritic: number | null
  igdb_id: number | null
  platform_logo_url: string | null
}

export type NewGamePayload = {
  title: string
  platform?: string
  rating: number
  cover_url?: string | null
  genre?: string | null
  release_year?: number | null
  metacritic?: number | null
  igdb_id?: number | null
  platform_logo_url?: string | null
}

export type IgdbSuggestion = {
  igdb_id: number
  title: string
  cover_url: string | null
  platforms: string[]
  platform_logo_url: string | null
  genres: string[]
  release_year: number | null
  metacritic: number | null
}
