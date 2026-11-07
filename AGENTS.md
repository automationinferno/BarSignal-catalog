# BarSignal-catalog — agent guide

## Where to look first

- `.github/copilot-instructions.md` — detailed architecture, conventions, and field‑level data rules
- `.github/agents/catalog-validator.agent.md` — a pre‑built agent for validate‑and‑repair workflows

## Commands

| Command | What it does |
|---|---|
| `npm run validate` | Schema + data‑type checks on `drinks.json` |
| `npm run validate:strict` | Same as validate plus **checks referenced image files exist on disk** |
| `npm run type-check` | TypeScript `--noEmit` — the closest thing to a typecheck pass |
| `npm run build` | Compile TS → `dist/` (CommonJS, ES2022) |
| `npm run thumbs` | Regenerate 512/1024 PNG thumbnails under `drinks/_thumbs/` via Sharp |
| `npm run placeholders -- <id> [more...]` | Write 1×1 placeholder PNGs to `drinks/<id>.png` (overwriting existing files). `build:site` needs square PNG originals of at least 1024×1024 px and refuses these, so they can't be published |
| `npm run build:site` | Encode missing WebP images into `docs/img/v1/`, update `docs/v1/drinks.json`, then run the site check (needs sharp from `npm ci`) |
| `npm run check:site` | Offline check of the Pages site in `docs/`: required files, drift from `drinks.json`, names, hashes, size budgets (never loads sharp) |
| `npm test` | `node --test scripts/`: runs every test file under `scripts/` with Node's built-in runner (`build-site.test.js` and `catalog-content.test.js`) |

There is **no linter**. Tests exist for `scripts/build-site.js` (`build-site.test.js`) and for catalog display text (`catalog-content.test.js`: every drink `name` and `aliases` entry in `drinks.json` and `docs/v1/drinks.json` must pass an explicit-word deny list, so adding such a name or alias fails CI). The validator scripts and `check:site` are the safety gate: `.github/workflows/check-site.yml` runs `npm test`, `validate:strict` and `check:site` on every PR and on pushes to `main`, and on PRs it also fails if an existing file under `docs/img/` is deleted, modified, renamed or changes type.

## Key conventions

- **Display text stays clean** — the app shows `aliases` on screen ("Also known as: …") and uses `name` as the display name, so never put explicit text in either (`scripts/catalog-content.test.js` enforces this). IDs and image file names are permanent (changing them would break released builds and favorites), so a drink renamed for display keeps its original id (e.g. `adios_motherfucker` is displayed as "Adios MF").
- **IDs** — lowercase `snake_case`, must match image filenames (e.g. `old_fashioned` → `drinks/old_fashioned.png`)
- **Image paths** — main images under `drinks/`, thumbnails under `drinks/_thumbs/`. All `.png`.
- **`imageVariants`** — accepts both `{sm, md}` and legacy `{512, 1024, thumb}` keys. The current data uses numeric keys; do not rewrite them without coordinating with the app.
- **`modifiersSupported`** — can be `boolean` or `string[]`. Do not narrow.
- **`flags.json`** — optional flat JSON (`forceTextOnly`, `catalogVersion`).
- **`imageSource`** — optional provenance URL; validated for absolute http(s) format.
- **jsDelivr still serves released app builds** — builds released before the switch to the Pages site fetch the root `drinks.json` via jsDelivr (`@main`) and join that base with its relative paths, so root catalog and `drinks/` paths must remain stable. Builds with the switch read `docs/v1/drinks.json` from the Pages site.
- **Thumbnails are CI‑generated** — `.github/workflows/build-thumbs.yml` runs on push to `main`, commits any changed thumbs back.
- **Pages site (`docs/`) is generated** — Pages publishes `main:/docs`. `npm run build:site` derives `docs/v1/drinks.json` (only `imagePath`/`imageVariants` rewritten; only the `512`, `1024` and `thumb` keys are supported) and `docs/img/v1/<id>_<512|1024>.<hash8>.webp` from `drinks.json` and each source `imagePath` (not `_thumbs`). Rerun it after any `drinks.json` or source-image change and commit `docs/`. Outputs are append-only (CI enforces this for `docs/img/` on PRs, not on direct pushes): never rename, overwrite or delete files in `docs/img/v1/` (released app builds may still reference them) and never hand-edit `docs/v1/drinks.json`. Never delete `docs/.nojekyll`. Details: README › "Catalog site (GitHub Pages)".

## Git aliases (team convention)

- `git new-work <base> <branch>` — checkout base, pull, create branch
- `git save` — `git add -A && git commit` (opens editor)
- `git savem <msg>` — `git add -A && git commit -m <msg>`
- `git done` — `git push -u origin HEAD`
- `git latest` — `git checkout main && git pull`

## Notable tsconfig quirks

- `exactOptionalPropertyTypes: true` — assigning `undefined` to an optional field where the type expects `string | null | undefined` (not just `string | undefined`) may cause type errors.
- `**/*.test.ts` is **excluded** from compilation — test files won't be built.
- `include` is `scripts/**/*` and `src/**/*` — any new script must go under one of these.
