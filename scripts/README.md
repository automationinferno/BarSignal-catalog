# BarSignal Catalog Validation

This directory contains scripts for validating the BarSignal cocktail catalog.

## Scripts

### `validate-catalog.ts`

A comprehensive validation script that checks the integrity of the `drinks.json` catalog file.

#### What it validates:

- **File Structure**: Ensures `drinks.json` exists and contains valid JSON
- **Data Types**: Verifies each drink entry has the correct field types
- **Unique IDs**: Ensures all drink IDs are unique across the catalog
- **ID Format**: Validates IDs are in snake_case format (lowercase, numbers, underscores only)
- **Required Fields**: Checks that all required fields are present and non-empty:
  - `id` (string, non-empty, snake_case)
  - `name` (string, non-empty)
  - `category` (string)
  - `popularity` (number, 0-100)
  - `imagePath` (string)
  - `imageVariants` (object with at least one variant)
- **Image Files** (optional): When `VALIDATE_IMAGE_FILES=true`, verifies that all referenced image files exist

#### Usage

```bash
# Basic validation (without checking image files)
npm run validate

# Strict validation (includes image file existence checks)
npm run validate:strict
```

#### Exit Codes

- **0**: Validation passed
- **1**: Validation failed (errors found)

#### Example Output

**Success:**
```
🍹 Validating BarSignal catalog...

✅ Catalog validation passed!
📊 Validated 50 drink entries
```

**Failure:**
```
🍹 Validating BarSignal catalog...

❌ Catalog validation failed!

Errors found:
  1. Drink at index 5: duplicate id "martini"
  2. Drink at index 12 (whiskey_sour): name must be a non-empty string
  3. Image file not found: drinks/missing_drink.png for drink "missing_drink"

💥 Found 3 error(s)
```

### `build-site.js`

Builds and checks the GitHub Pages site under `docs/` (`docs/v1/drinks.json` and
`docs/img/v1/*.webp`). See "Catalog site (GitHub Pages)" in the root `README.md` for the
URL layout and the append-only rules.

Every output must be exactly 512×512 or 1024×1024 px, so source images must be square
PNGs of at least 1024×1024 px. Before encoding anything, the build refuses sources that
are not PNGs or are smaller than a variant instead of upscaling them. The 1×1 PNGs that
`generate-placeholders.js` (`npm run placeholders`) writes therefore make `build:site`
fail; replace them with full-size cards before building the site.

#### Usage

```bash
# Encode missing WebP images, update docs/v1/drinks.json, then run the check (needs sharp from npm ci)
npm run build:site

# Offline check only (Node built-ins, no install needed)
npm run check:site

# Unit tests: every test file under scripts/ (node --test scripts/)
npm test
```

#### Exit Codes

- **0**: Check passed
- **1**: Check or build failed
- **2**: Unknown argument

It is plain CommonJS JavaScript, so `npm run type-check` does not cover it; `npm test` does.

## Development

The validation script is written in TypeScript and can be:

- Run directly: `npm run validate`
- Built: `npm run build` 
- Type-checked: `npm run type-check`

### Dependencies

- `typescript`: TypeScript compiler
- `tsx`: TypeScript execution environment
- `@types/node`: Node.js type definitions
- `cross-env`: Cross-platform environment variables

## Environment Variables

- `VALIDATE_IMAGE_FILES`: Set to `"true"` to enable image file existence validation
