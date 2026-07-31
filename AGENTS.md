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
| `npm run placeholders -- <id> [more...]` | Generate placeholder PNGs for specific drink IDs |

There is **no test runner** and **no linter**. The validator scripts are the safety gate.

## Key conventions

- **IDs** — lowercase `snake_case`, must match image filenames (e.g. `old_fashioned` → `drinks/old_fashioned.png`)
- **Image paths** — main images under `drinks/`, thumbnails under `drinks/_thumbs/`. All `.png`.
- **`imageVariants`** — accepts both `{sm, md}` and legacy `{512, 1024, thumb}` keys. The current data uses numeric keys; do not rewrite them without coordinating with the app.
- **`modifiersSupported`** — can be `boolean` or `string[]`. Do not narrow.
- **`flags.json`** — optional flat JSON (`forceTextOnly`, `catalogVersion`).
- **`imageSource`** — optional provenance URL; validated for absolute http(s) format.
- **Catalog is served via jsDelivr CDN** — paths must remain stable; the app joins a CDN base with relative paths from this repo.
- **Thumbnails are CI‑generated** — `.github/workflows/build-thumbs.yml` runs on push to `main`, commits any changed thumbs back.

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
