import { invoke } from '@tauri-apps/api/core'
import type { Game, IgdbSuggestion, NewGamePayload, IgdbGameDetails } from './types'

export async function getGames(search: string) {
  return invoke<Game[]>('list_games', { search })
}

export async function addGame(payload: NewGamePayload) {
  return invoke<Game>('create_game', { payload })
}

export async function removeGame(id: number) {
  return invoke<{ ok: boolean; data: boolean }>('delete_game', { id })
}

export async function searchIgdb(query: string) {
  return invoke<IgdbSuggestion[]>('search_igdb', { query })
}

export async function getGameDetails(igdbId: number) {
  return invoke<IgdbGameDetails>('get_igdb_game_details', { igdbId })
}
