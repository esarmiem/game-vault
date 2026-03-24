use reqwest::blocking::Client;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::Manager;

const EMBEDDED_IGDB_CLIENT_ID: &str = "h5z2ruq3jdwnrulwfzyshde3col3te";
const EMBEDDED_IGDB_CLIENT_SECRET: &str = "u371665lqbnpkwqeubna71kzq5otwb";

struct AppState {
  db: Mutex<Connection>,
  igdb_token: Mutex<Option<TokenCache>>,
}

struct TokenCache {
  token: String,
  expires_at: Instant,
}

#[derive(Debug, Serialize, Deserialize)]
struct Game {
  id: i64,
  title: String,
  platform: String,
  rating: i64,
  cover_url: Option<String>,
  genre: Option<String>,
  release_year: Option<i64>,
  metacritic: Option<i64>,
  igdb_id: Option<i64>,
  platform_logo_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct NewGamePayload {
  title: String,
  platform: Option<String>,
  rating: i64,
  cover_url: Option<String>,
  genre: Option<String>,
  release_year: Option<i64>,
  metacritic: Option<i64>,
  igdb_id: Option<i64>,
  platform_logo_url: Option<String>,
}

#[derive(Debug, Serialize)]
struct IgdbSuggestion {
  igdb_id: i64,
  title: String,
  cover_url: Option<String>,
  platforms: Vec<String>,
  platform_logo_url: Option<String>,
  genres: Vec<String>,
  release_year: Option<i64>,
  metacritic: Option<i64>,
}

#[derive(Debug, Serialize)]
struct ApiResponse<T> {
  ok: bool,
  data: T,
}

#[derive(Debug, Deserialize)]
struct TwitchAuthResponse {
  access_token: String,
  expires_in: u64,
}

#[derive(Debug, Deserialize)]
struct IgdbRawItem {
  id: i64,
  name: String,
  cover: Option<IgdbCover>,
  platforms: Option<Vec<IgdbPlatform>>,
  genres: Option<Vec<IgdbName>>,
  first_release_date: Option<i64>,
  aggregated_rating: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct IgdbCover {
  url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct IgdbPlatform {
  name: String,
  platform_logo: Option<IgdbPlatformLogo>,
}

#[derive(Debug, Deserialize)]
struct IgdbPlatformLogo {
  url: Option<String>,
}

#[derive(Debug, Serialize)]
struct IgdbGameDetails {
  artworks: Vec<String>,
  screenshots: Vec<String>,
  videos: Vec<String>,
  developer: Option<String>,
  languages: Vec<String>,
  multiplayer: Option<String>,
}

#[derive(Debug, Deserialize)]
struct IgdbDetailsRaw {
  artworks: Option<Vec<IgdbArtwork>>,
  screenshots: Option<Vec<IgdbArtwork>>,
  videos: Option<Vec<IgdbVideo>>,
  involved_companies: Option<Vec<IgdbInvolvedCompany>>,
  language_supports: Option<Vec<IgdbLanguageSupport>>,
  multiplayer_modes: Option<Vec<IgdbMultiplayerMode>>,
}

#[derive(Debug, Deserialize)]
struct IgdbArtwork {
  url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct IgdbVideo {
  video_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct IgdbInvolvedCompany {
  developer: Option<bool>,
  company: Option<IgdbCompany>,
}

#[derive(Debug, Deserialize)]
struct IgdbCompany {
  name: String,
}

#[derive(Debug, Deserialize)]
struct IgdbLanguageSupport {
  language: Option<IgdbLanguage>,
}

#[derive(Debug, Deserialize)]
struct IgdbLanguage {
  name: String,
}

#[derive(Debug, Deserialize)]
struct IgdbMultiplayerMode {
  campaigncoop: Option<bool>,
  lancoop: Option<bool>,
  offlinecoop: Option<bool>,
  onlinecoop: Option<bool>,
  splitscreen: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct IgdbName {
  name: String,
}

fn setup_database(conn: &Connection) -> Result<(), String> {
  conn
    .execute_batch(
      r#"
      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        platform TEXT NOT NULL DEFAULT '',
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
        cover_url TEXT,
        genre TEXT,
        release_year INTEGER,
        metacritic INTEGER,
        igdb_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_games_title ON games(title);
      CREATE INDEX IF NOT EXISTS idx_games_platform ON games(platform);
      "#,
    )
    .map_err(|error| format!("No se pudo crear la base de datos: {error}"))?;

  // Añadir columna platform_logo_url si no existe
  let _ = conn.execute("ALTER TABLE games ADD COLUMN platform_logo_url TEXT", []);

  Ok(())
}

fn map_game_row(row: &rusqlite::Row<'_>) -> Result<Game, rusqlite::Error> {
  // Manejar el caso donde la columna platform_logo_url no fue retornada o es nula
  // Es más seguro obtener por índice, asumiendo que hemos actualizado todas las consultas.
  Ok(Game {
    id: row.get(0)?,
    title: row.get(1)?,
    platform: row.get(2)?,
    rating: row.get(3)?,
    cover_url: row.get(4)?,
    genre: row.get(5)?,
    release_year: row.get(6)?,
    metacritic: row.get(7)?,
    igdb_id: row.get(8)?,
    platform_logo_url: row.get(9)?,
  })
}

fn normalize_cover_url(raw_url: Option<String>) -> Option<String> {
  raw_url.and_then(|value| {
    if value.trim().is_empty() {
      return None;
    }

    let with_protocol = if value.starts_with("//") {
      format!("https:{value}")
    } else {
      value
    };

    Some(with_protocol.replace("t_thumb", "t_cover_big"))
  })
}

fn release_year_from_unix(value: Option<i64>) -> Option<i64> {
  value.and_then(|timestamp| {
    let year = 1970 + (timestamp / 31_556_952);
    if year > 1970 && year < 2100 {
      Some(year)
    } else {
      None
    }
  })
}

fn load_environment_files(app_dir: &Path) {
  dotenvy::dotenv().ok();

  let local_app_env = app_dir.join(".env");
  if local_app_env.exists() {
    let _ = dotenvy::from_path_override(local_app_env);
  }

  if let Ok(home) = std::env::var("HOME") {
    let user_env = PathBuf::from(home).join(".game-vault.env");
    if user_env.exists() {
      let _ = dotenvy::from_path_override(user_env);
    }
  }
}

fn get_igdb_credentials() -> (String, String) {
  let client_id = std::env::var("IGDB_CLIENT_ID")
    .ok()
    .filter(|value| !value.trim().is_empty())
    .unwrap_or_else(|| EMBEDDED_IGDB_CLIENT_ID.to_string());
  let client_secret = std::env::var("IGDB_CLIENT_SECRET")
    .ok()
    .filter(|value| !value.trim().is_empty())
    .unwrap_or_else(|| EMBEDDED_IGDB_CLIENT_SECRET.to_string());

  (client_id, client_secret)
}

fn get_igdb_token(state: &AppState) -> Result<String, String> {
  let (client_id, client_secret) = get_igdb_credentials();

  {
    let cached = state
      .igdb_token
      .lock()
      .map_err(|_| "No se pudo acceder al token en memoria".to_string())?;
    if let Some(current) = cached.as_ref() {
      if current.expires_at > Instant::now() + Duration::from_secs(15) {
        return Ok(current.token.clone());
      }
    }
  }

  let client = Client::new();
  let response = client
    .post("https://id.twitch.tv/oauth2/token")
    .query(&[
      ("client_id", client_id.as_str()),
      ("client_secret", client_secret.as_str()),
      ("grant_type", "client_credentials"),
    ])
    .send()
    .map_err(|error| format!("No se pudo autenticar con Twitch: {error}"))?;

  if !response.status().is_success() {
    return Err(format!(
      "Error autenticando con Twitch: código {}",
      response.status()
    ));
  }

  let payload: TwitchAuthResponse = response
    .json()
    .map_err(|error| format!("No se pudo leer token de Twitch: {error}"))?;

  let token = payload.access_token;
  let expires_at = Instant::now() + Duration::from_secs(payload.expires_in.saturating_sub(30));

  {
    let mut cached = state
      .igdb_token
      .lock()
      .map_err(|_| "No se pudo guardar el token en memoria".to_string())?;
    *cached = Some(TokenCache {
      token: token.clone(),
      expires_at,
    });
  }

  Ok(token)
}

#[tauri::command]
fn list_games(state: tauri::State<'_, AppState>, search: Option<String>) -> Result<Vec<Game>, String> {
  let conn = state
    .db
    .lock()
    .map_err(|_| "No se pudo acceder a la base de datos".to_string())?;
  let normalized = search.unwrap_or_default().trim().to_lowercase();

  if normalized.is_empty() {
    let mut statement = conn
      .prepare(
        r#"
        SELECT id, title, platform, rating, cover_url, genre, release_year, metacritic, igdb_id, platform_logo_url
        FROM games
        ORDER BY title ASC
        "#,
      )
      .map_err(|error| format!("No se pudo consultar juegos: {error}"))?;

    let rows = statement
      .query_map([], map_game_row)
      .map_err(|error| format!("No se pudo leer juegos: {error}"))?;

    let games = rows.filter_map(Result::ok).collect();
    return Ok(games);
  }

  let search_pattern = format!("%{normalized}%");
  let mut statement = conn
    .prepare(
      r#"
      SELECT id, title, platform, rating, cover_url, genre, release_year, metacritic, igdb_id, platform_logo_url
      FROM games
      WHERE lower(title) LIKE ?1 OR lower(platform) LIKE ?1
      ORDER BY title ASC
      "#,
    )
    .map_err(|error| format!("No se pudo buscar juegos: {error}"))?;

  let rows = statement
    .query_map([search_pattern], map_game_row)
    .map_err(|error| format!("No se pudo leer resultados: {error}"))?;

  let games = rows.filter_map(Result::ok).collect();
  Ok(games)
}

#[tauri::command]
fn create_game(state: tauri::State<'_, AppState>, payload: NewGamePayload) -> Result<Game, String> {
  if payload.title.trim().is_empty() {
    return Err("El nombre del juego es obligatorio".to_string());
  }
  if !(1..=5).contains(&payload.rating) {
    return Err("La calificación debe estar entre 1 y 5".to_string());
  }

  let conn = state
    .db
    .lock()
    .map_err(|_| "No se pudo acceder a la base de datos".to_string())?;
  conn
    .execute(
      r#"
      INSERT INTO games (title, platform, rating, cover_url, genre, release_year, metacritic, igdb_id, platform_logo_url, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, CURRENT_TIMESTAMP)
      "#,
      params![
        payload.title.trim(),
        payload.platform.unwrap_or_default().trim(),
        payload.rating,
        payload.cover_url,
        payload.genre,
        payload.release_year,
        payload.metacritic,
        payload.igdb_id,
        payload.platform_logo_url
      ],
    )
    .map_err(|error| format!("No se pudo guardar el juego: {error}"))?;

  let id = conn.last_insert_rowid();
  let mut statement = conn
    .prepare(
      r#"
      SELECT id, title, platform, rating, cover_url, genre, release_year, metacritic, igdb_id, platform_logo_url
      FROM games
      WHERE id = ?1
      "#,
    )
    .map_err(|error| format!("No se pudo recuperar el juego: {error}"))?;

  let game = statement
    .query_row([id], map_game_row)
    .map_err(|error| format!("No se pudo leer el juego guardado: {error}"))?;

  Ok(game)
}

#[tauri::command]
fn delete_game(state: tauri::State<'_, AppState>, id: i64) -> Result<ApiResponse<bool>, String> {
  let conn = state
    .db
    .lock()
    .map_err(|_| "No se pudo acceder a la base de datos".to_string())?;
  let affected = conn
    .execute("DELETE FROM games WHERE id = ?1", [id])
    .map_err(|error| format!("No se pudo eliminar el juego: {error}"))?;

  Ok(ApiResponse {
    ok: affected > 0,
    data: affected > 0,
  })
}

#[tauri::command]
fn search_igdb(state: tauri::State<'_, AppState>, query: String) -> Result<Vec<IgdbSuggestion>, String> {
  let trimmed = query.trim();
  if trimmed.len() < 2 {
    return Ok(Vec::new());
  }

  let (client_id, _) = get_igdb_credentials();
  let token = get_igdb_token(&state)?;
  let body = format!(
    "search \"{}\"; fields name,cover.url,platforms.name,platforms.platform_logo.url,genres.name,first_release_date,aggregated_rating; limit 8;",
    trimmed.replace('\"', "")
  );

  let client = Client::new();
  let response = client
    .post("https://api.igdb.com/v4/games")
    .header("Client-ID", client_id)
    .header("Authorization", format!("Bearer {token}"))
    .header("Accept", "application/json")
    .body(body)
    .send()
    .map_err(|error| format!("No se pudo consultar IGDB: {error}"))?;

  if !response.status().is_success() {
    return Err(format!("IGDB devolvió un error: código {}", response.status()));
  }

  let raw_items: Vec<IgdbRawItem> = response
    .json()
    .map_err(|error| format!("No se pudo leer la respuesta de IGDB: {error}"))?;

  let suggestions = raw_items
    .into_iter()
    .map(|item| {
      let mut platform_names = Vec::new();
      let mut platform_logos = Vec::new();

      if let Some(platforms) = item.platforms {
        for p in platforms {
          platform_names.push(p.name);
          let mut url_str = String::new();
          if let Some(logo) = p.platform_logo {
            if let Some(url) = logo.url {
              url_str = if url.starts_with("//") {
                format!("https:{url}")
              } else {
                url.clone()
              };
            }
          }
          platform_logos.push(url_str);
        }
      }

      let logo_url = if platform_logos.iter().all(|s| s.is_empty()) {
        None
      } else {
        Some(platform_logos.join(","))
      };

      IgdbSuggestion {
        igdb_id: item.id,
        title: item.name,
        cover_url: normalize_cover_url(item.cover.and_then(|cover| cover.url)),
        platforms: platform_names,
        platform_logo_url: logo_url,
        genres: item
          .genres
          .unwrap_or_default()
          .into_iter()
          .map(|entry| entry.name)
          .collect(),
        release_year: release_year_from_unix(item.first_release_date),
        metacritic: item
          .aggregated_rating
          .map(|value| value.round())
          .filter(|value| *value >= 0.0 && *value <= 100.0)
          .map(|value| value as i64),
      }
    })
    .collect();

  Ok(suggestions)
}

#[tauri::command]
fn get_igdb_game_details(state: tauri::State<'_, AppState>, igdb_id: i64) -> Result<IgdbGameDetails, String> {
  let (client_id, _) = get_igdb_credentials();
  let token = get_igdb_token(&state)?;
  let body = format!(
    "fields artworks.url, screenshots.url, videos.video_id, involved_companies.developer, involved_companies.company.name, language_supports.language.name, multiplayer_modes.campaigncoop, multiplayer_modes.lancoop, multiplayer_modes.offlinecoop, multiplayer_modes.onlinecoop, multiplayer_modes.splitscreen; where id = {};",
    igdb_id
  );

  let client = Client::new();
  let response = client
    .post("https://api.igdb.com/v4/games")
    .header("Client-ID", client_id)
    .header("Authorization", format!("Bearer {token}"))
    .header("Accept", "application/json")
    .body(body)
    .send()
    .map_err(|error| format!("No se pudo consultar detalles en IGDB: {error}"))?;

  if !response.status().is_success() {
    return Err(format!("IGDB devolvió un error: código {}", response.status()));
  }

  let raw_items: Vec<IgdbDetailsRaw> = response
    .json()
    .map_err(|error| format!("No se pudo leer la respuesta de detalles de IGDB: {error}"))?;

  let item = match raw_items.into_iter().next() {
    Some(i) => i,
    None => return Err("No se encontró el juego en IGDB".to_string()),
  };

  let artworks = item
    .artworks
    .unwrap_or_default()
    .into_iter()
    .filter_map(|a| normalize_cover_url(a.url))
    .map(|url| url.replace("t_cover_big", "t_1080p"))
    .collect();

  let screenshots = item
    .screenshots
    .unwrap_or_default()
    .into_iter()
    .filter_map(|s| normalize_cover_url(s.url))
    .map(|url| url.replace("t_cover_big", "t_1080p"))
    .collect();

  let videos = item
    .videos
    .unwrap_or_default()
    .into_iter()
    .filter_map(|v| v.video_id)
    .collect();

  let developer = item.involved_companies.and_then(|comps| {
    comps.into_iter().find(|c| c.developer.unwrap_or(false)).and_then(|c| c.company).map(|c| c.name)
  });

  let mut languages = item
    .language_supports
    .unwrap_or_default()
    .into_iter()
    .filter_map(|ls| ls.language.map(|l| l.name))
    .collect::<Vec<_>>();
  languages.sort();
  languages.dedup();

  let multiplayer = item.multiplayer_modes.and_then(|modes| {
    if let Some(m) = modes.into_iter().next() {
      let mut features = Vec::new();
      if m.campaigncoop.unwrap_or(false) { features.push("Co-op de Campaña"); }
      if m.lancoop.unwrap_or(false) { features.push("Co-op LAN"); }
      if m.offlinecoop.unwrap_or(false) { features.push("Co-op Offline"); }
      if m.onlinecoop.unwrap_or(false) { features.push("Co-op Online"); }
      if m.splitscreen.unwrap_or(false) { features.push("Pantalla Dividida"); }
      
      if features.is_empty() {
        Some("Single Player".to_string())
      } else {
        Some(features.join(", "))
      }
    } else {
      Some("Single Player".to_string())
    }
  });

  Ok(IgdbGameDetails {
    artworks,
    screenshots,
    videos,
    developer,
    languages,
    multiplayer,
  })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("No se pudo resolver el directorio de datos: {error}"))?;
      std::fs::create_dir_all(&app_dir)
        .map_err(|error| format!("No se pudo crear el directorio de datos: {error}"))?;
      load_environment_files(&app_dir);
      let db_path = app_dir.join("game_vault.sqlite");

      let connection = Connection::open(db_path)
        .map_err(|error| format!("No se pudo abrir la base de datos: {error}"))?;
      setup_database(&connection)?;

      app.manage(AppState {
        db: Mutex::new(connection),
        igdb_token: Mutex::new(None),
      });

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      list_games,
      create_game,
      delete_game,
      search_igdb,
      get_igdb_game_details
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
