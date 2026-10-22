# base-mechanics
A repository for a template for base mechanics for commitee development.

## Pokémon battle animator

The home page is the SSICSIM committee workspace, with **Crisis Tracker** and
**Battle Generator** tabs. In Battle Generator, choose the left and right Pokémon,
pick the winning side, and press **Make video**. Open `/?tab=battle` to select
the generator directly. The `/login` password screen still protects the workspace. This plays an interactive slideshow
(not an exported video file). Click anywhere, press Space, Enter, or the right
arrow to advance:

1. Left Pokémon fullscreen.
2. Right Pokémon fullscreen.
3. Both Pokémon side by side, shaking independently in 12 held poses per second.
4. Fade to white.
5. Fade from white to the winner's victory animation.
6. Fade to black.
7. Return to the menu.

Playback fills each frame with centered cropping rather than letterboxing.
The shake uses hard 12 fps pose changes; reduced-motion preferences disable it.
There are no visible controls during playback. Escape returns to the menu.
The start button requests browser fullscreen; shared links fill the viewport
immediately and request browser fullscreen on the first click.

Use **Copy battle link** to share a combination, for example
`/battle?left=Pikachu&right=Snorlax&winner=left`. Existing staff login applies;
the battle URL is preserved through login.

### Animation assets and orientation

- Use **Add Pokémon** in Battle Generator to upload a battle animation and optional
  victory animation, with the original facing direction for each. Files save directly
  to these folders and orientations update automatically; the new Pokémon appears
  in the selector without reloading. Uploads require staff login, reject duplicate
  names, and accept PNG/APNG, GIF, JPEG, WebP, MP4/M4V, or WebM (50 MB per file).
- Uploads can include a trainer: choose an existing name or enter a new one.
  Trainers appear beside Pokémon in the selector and below the selected preview.
  Trainer names are stored in the Pokémon's `trainer` field in `orientations.json`;
  Mega forms inherit the base Pokémon's trainer unless they specify their own.
- Put battle assets in `backend/pokemon/battle/` and victory assets in
  `backend/pokemon/victory/`. Keep one asset per Pokémon per folder.
- Names can be `[Pokemon-Name].[extension]` or
  `[Pokemon-Name]_battle.[extension]` / `[Pokemon-Name]_victory.[extension]`.
  The folder determines the role; the extension does not affect name matching.
- Images support GIF, PNG/APNG, JPEG/JFIF, WebP, AVIF, SVG, BMP, and ICO.
  Videos support MP4/M4V, WebM, OGV, and MOV, played muted and looping without
  controls. Actual playback depends on the browser's format/codec support.
  Formats and response MIME types are centralized in
  `frontend/lib/pokemon-media.ts`.
- A missing victory asset falls back to the battle asset and its orientation.
- Reload the menu after adding assets or editing orientations. The catalog
  and configuration are read on each page request.
- Edit `backend/pokemon/orientations.json`: `default` sets the default facing
  direction, and `pokemon` overrides it by Pokémon name (without suffix).
  Values are `"left"` or `"right"`, describing the original media. Pokémon
  on the left face left, and those on the right face right; media flips
  automatically when needed, for all image and video formats. A string applies
  to both battle and victory. An object can override them separately; omitted
  directions use `default`. New Pokémon without entries also use `default`.

  ```json
  {
    "default": "left",
    "pokemon": {
      "Pikachu": "right",
      "Snorlax": { "battle": "left", "victory": "right" }
    }
  }
  ```

- Docker mounts this directory read-write into the frontend at `/pokemon`.
  For a different deployment layout, set `POKEMON_ASSET_DIR` to the asset
  directory's absolute path and ensure the frontend process can write to it.

## Structure

- `backend/` — FastAPI app (SQLAlchemy + Alembic). No business endpoints yet —
  just a `/api/health` check and the folders (`api/`, `models/`, `services/`,
  `utilities/`) to build into.
- `frontend/` — Next.js (App Router) + Tailwind v4 + React Query, themed from
  the project's Figma design tokens. The full shadcn/ui component library is
  vendored in `components/ui/`; see them all at `/components`. The
  `hooks/`, `services/`, `stores/`, `types/`, `utils/` folders are ready to
  build into.
- `docker-compose.yml` — wires up Postgres, the backend API, and the frontend
  dev server.

## Running locally

```bash
cp .env.example .env   # already done if you cloned this template as-is
docker compose up
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000 (docs at `/docs`, health at `/api/health`)

See [`docs/development.md`](docs/development.md) for what each
`.env` variable does, how requests are routed, and common setup mistakes.
