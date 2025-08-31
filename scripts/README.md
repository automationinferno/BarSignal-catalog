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
