# Game Vault

Aplicación de escritorio multiplataforma para gestionar tu biblioteca de juegos con almacenamiento local.
<img width="1226" height="838" alt="image" src="https://github.com/user-attachments/assets/08c362e4-fb07-4c0b-ae19-d6ca0c729923" />


## Stack

- Tauri v2
- React + TypeScript
- SQLite (archivo local por usuario)
- IGDB API para autocomplete

## Variables de entorno

1. Copia `.env.example` a `.env`.
2. Completa:

```bash
IGDB_CLIENT_ID=tu_client_id
IGDB_CLIENT_SECRET=tu_client_secret
```

`IGDB_CLIENT_SECRET` se usa únicamente en el backend de Tauri.

## Desarrollo

```bash
pnpm install
pnpm tauri dev
```

## Build instalable

```bash
pnpm tauri build
```

Genera instaladores para el sistema operativo actual.

## Funcionalidades actuales

- Búsqueda local por nombre o plataforma.
- Alta de juego con botón `+ Agregar juego`.
- Eliminación de filas con botón `x`.
- Calificación visual en estrellas de 1 a 5.
- Visualización de carátula.
- Autocompletado desde IGDB por nombre del juego.
