# Game Vault

Aplicación de escritorio multiplataforma para gestionar tu biblioteca de juegos con almacenamiento local.
<img width="1226" height="838" alt="image" src="https://github.com/user-attachments/assets/08c362e4-fb07-4c0b-ae19-d6ca0c729923" />


## Stack

- Tauri v2
- React + TypeScript
- SQLite (archivo local por usuario)
- IGDB API para autocomplete

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

## Variables de entorno (nota)

El build incluye credenciales IGDB embebidas para usar la app instalada sin configuración manual.

Si quieres sobrescribir esas credenciales (opcional), puedes usar variables de entorno en desarrollo o crear:

- `~/Library/Application Support/com.alaskatech.gamevault/.env`
- `~/.game-vault.env`
