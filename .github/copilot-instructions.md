# Copilot Instructions

## Commands

- Install dependencies: `npm ci`
- Validate catalog schema and data types: `npm run validate`
- Validate schema plus referenced image files: `npm run validate:strict`
- Type-check TypeScript scripts without emitting output: `npm run type-check`
- Build TypeScript output into `dist/`: `npm run build`
- Regenerate thumbnails from source images in `drinks/`: `npm run thumbs`
- Generate 1×1 placeholder PNGs at `drinks/<drink_id>.png` (overwriting existing files): `npm run placeholders -- <drink_id> [more_ids...]`. `npm run build:site` refuses them (sources must be square PNGs of at least 1024×1024 px), so placeholders can never be published.
- Build the GitHub Pages site under `docs/` (encode missing WebP images, update `docs/v1/drinks.json`, then run the site check; needs sharp from `npm ci`): `npm run build:site`
- Check the Pages site offline (Node built-ins only, no install needed): `npm run check:site`
- Run every test file under `scripts/` (today only `scripts/build-site.test.js`): `npm test`
- Run a single test by name: `node --test --test-name-pattern="<test name>" scripts/build-site.test.js`

There is currently **no lint script**. `npm test` (`node --test scripts/`) runs every test file under `scripts/` with Node's built-in `node:test` runner; today only `scripts/build-site.js` has tests. The validator scripts and `npm run check:site` are the main safety checks for this repo. `.github/workflows/check-site.yml` runs `npm test`, `npm run validate:strict` and `npm run check:site` on every pull request and on pushes to `main`; on pull requests it first fails if the PR deletes, modifies, renames or changes the type of any existing file under `docs/img/` (compared with the PR base).

## High-level architecture

- This repository is a **public catalog + asset source** for the BarSignal app. App builds released before the switch to the GitHub Pages site fetch the root `drinks.json` and the image files it references through jsDelivr (`https://cdn.jsdelivr.net/gh/automationinferno/BarSignal-catalog@main`), so those paths must stay stable. Builds that include the switch load the generated Pages site described below instead.
- `drinks.json` is the canonical catalog. Each entry carries both app-facing drink metadata and the file references for the source image in `drinks/` plus generated thumbnails in `drinks/_thumbs/`.
- `scripts/validate-catalog.ts` is the main integrity gate. It validates catalog shape, required fields, ID format, duplicate IDs, image path prefixes, optional metadata types, and the shape of `flags.json`. In strict mode it also verifies that every referenced image file actually exists on disk.
- Thumbnail generation is a separate derived-asset pipeline: `scripts/generate-thumbs.js` creates 512px and 1024px PNG thumbnails under `drinks/_thumbs/`, and `.github/workflows/build-thumbs.yml` reruns that generation on pushes to `main` and commits any changed thumbnails back to the repository.
- The GitHub Pages site is a second derived-asset pipeline. Pages publishes `main:/docs` (https://automationinferno.github.io/BarSignal-catalog/), which also hosts the privacy policy. `scripts/build-site.js` (plain CommonJS outside `tsc`, unit-tested by `scripts/build-site.test.js`) writes `docs/v1/drinks.json`, the root catalog with only `imagePath` and `imageVariants` rewritten, and WebP files `docs/img/v1/<id>_<512|1024>.<hash8>.webp` encoded with sharp from each drink's source `imagePath` rather than `drinks/_thumbs/`, so `build-thumbs.yml` cannot make the site stale. The 512 file backs `imageVariants["512"]` and `["thumb"]`; the 1024 file backs `["1024"]` and `imagePath`. `hash8` is the first 8 hex characters of `sha256(source bytes + "w=<width>;q=85;e=6")`. Its `--check` mode (`npm run check:site`) never loads sharp. It fails on drift from `drinks.json`, stale hashes, missing or over-budget referenced files, unexpected files in `docs/img/v1/`, and a missing `docs/.nojekyll` or privacy-policy file. It also reads the VP8/VP8L/VP8X header of every file in `docs/img/v1/`, referenced or not, and fails unless it is a WebP of exactly the 512×512 or 1024×1024 px its name says (budgets apply only to referenced files). `flags.json` is not published to the site.

## Key conventions

- Keep `drinks.json` and the file system in sync. If a drink image or thumbnail path changes, update the JSON entry and regenerate thumbnails before considering the change complete. After any `drinks.json` or source-image change, also run `npm run build:site` and commit the `docs/` changes.
- Pages site images are append-only, and `check-site.yml` enforces it for all of `docs/img/` on pull requests (direct pushes to `main` are not checked): never rename, overwrite or delete files in `docs/img/v1/` (released app builds may still reference them). Never hand-edit `docs/v1/drinks.json`, and never delete `docs/.nojekyll`.
- Drink IDs are lowercase `snake_case` and are expected to line up with image filenames. Example: `old_fashioned` maps to `drinks/old_fashioned.png`, `drinks/_thumbs/old_fashioned_512.png`, and `drinks/_thumbs/old_fashioned_1024.png`.
- The validator prefers `imageVariants.sm` and `imageVariants.md`. It still tolerates legacy numeric keys like `imageVariants["512"]` and `imageVariants["1024"]`; note that the current `drinks.json` also still uses those numeric keys plus `thumb` (pointing to the 512px file). `npm run build:site` maps only `512`, `1024` and `thumb` and fails on any other key, so switching keys also needs a `scripts/build-site.js` change.
- `modifiersSupported` is intentionally flexible in this repo: it may be either `boolean` or `string[]`. Do not narrow that field in data or code without updating both sides together.
- `flags.json` is optional, but when present it is expected to stay as a flat JSON object for lightweight catalog-wide runtime flags such as `forceTextOnly` and `catalogVersion`.
