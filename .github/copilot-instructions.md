# Copilot Instructions

## Commands

- Install dependencies: `npm ci`
- Validate catalog schema and data types: `npm run validate`
- Validate schema plus referenced image files: `npm run validate:strict`
- Type-check TypeScript scripts without emitting output: `npm run type-check`
- Build TypeScript output into `dist/`: `npm run build`
- Regenerate thumbnails from source images in `drinks/`: `npm run thumbs`
- Generate placeholder PNGs for specific drink IDs: `npm run placeholders -- <drink_id> [more_ids...]`

There is currently **no lint script** and **no formal test runner / single-test command** in `package.json`; the validator scripts are the main safety checks for this repo.

## High-level architecture

- This repository is a **public catalog + asset source** for the BarSignal app. The app is expected to consume `drinks.json`, `flags.json`, and image files from this repo through jsDelivr, so path stability matters.
- `drinks.json` is the canonical catalog. Each entry carries both app-facing drink metadata and the file references for the source image in `drinks/` plus generated thumbnails in `drinks/_thumbs/`.
- `scripts/validate-catalog.ts` is the main integrity gate. It validates catalog shape, required fields, ID format, duplicate IDs, image path prefixes, optional metadata types, and the shape of `flags.json`. In strict mode it also verifies that every referenced image file actually exists on disk.
- Thumbnail generation is a separate derived-asset pipeline: `scripts/generate-thumbs.js` creates 512px and 1024px PNG thumbnails under `drinks/_thumbs/`, and `.github/workflows/build-thumbs.yml` reruns that generation on pushes to `main` and commits any changed thumbnails back to the repository.

## Key conventions

- Keep `drinks.json` and the file system in sync. If a drink image or thumbnail path changes, update the JSON entry and regenerate thumbnails before considering the change complete.
- Drink IDs are lowercase `snake_case` and are expected to line up with image filenames. Example: `old_fashioned` maps to `drinks/old_fashioned.png`, `drinks/_thumbs/old_fashioned_512.png`, and `drinks/_thumbs/old_fashioned_1024.png`.
- The current catalog uses `imageVariants["512"]`, `imageVariants["1024"]`, and `thumb` (pointing to the 512px file). The validator still tolerates legacy `sm` / `md` keys, so preserve the existing numeric-key convention unless intentionally migrating the whole catalog and validator together.
- `modifiersSupported` is intentionally flexible in this repo: it may be either `boolean` or `string[]`. Do not narrow that field in data or code without updating both sides together.
- `flags.json` is optional, but when present it is expected to stay as a flat JSON object for lightweight catalog-wide runtime flags such as `forceTextOnly` and `catalogVersion`.
