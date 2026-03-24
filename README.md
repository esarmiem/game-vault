<div align="center">
  <h1>Game Vault</h1>
  <img width="200" height="200" alt="logogv" src="https://github.com/user-attachments/assets/816a25c3-1e05-4729-beb5-7cdbcb8c7c02" />
</div>


#### Aplicación de escritorio multiplataforma para gestionar tu biblioteca de juegos con almacenamiento local.

<img width="800" height="600" alt="vault" src="https://github.com/user-attachments/assets/bc269591-5261-4465-bbe2-342a93ffccc9" />


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
