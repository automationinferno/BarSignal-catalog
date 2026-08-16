---
name: create-drink-cards
description: Create or replace BarSignal drink image cards with consistent product photography, exact catalog names, manufacturer-faithful bottles or cans, and generated thumbnails. Use for requests to add, recreate, replace, expand, or improve drink artwork in this repository, especially beer, cocktail, bottle, can, or `_cat`-filtered catalog work.
---

# Create Drink Cards

Create catalog-ready drink cards that match the established BarSignal visual system. Keep image generation focused on the product photo and compose the footer locally so the drink name is exact and readable.

## Workflow

1. Inspect `drinks.json`, the target image path, and several neighboring cards before generating anything. Ignore every source or catalog item whose name ends in `_cat`.
2. Resolve the canonical drink ID and name from `drinks.json`. Use lowercase `snake_case` IDs and keep the ID, JSON entry, source image, and thumbnail filenames synchronized.
3. Use the available image-generation capability for the photo. Prefer a real manufacturer packaging reference from the legacy project, a supplied reference, or an authoritative product image when brand identity matters. Preserve the exact product variant; do not substitute a related variant.
4. Generate one complete product on a professional, warm bar background: full bottle, can, glass, or package visible from edge to edge, no cropping, no sidebars, no borders, no hands, no extra products, and no footer or overlay text in the generated photo.
5. Use `scripts/build-card.mjs` from this skill to compose the final card. It creates a 1254×1254 PNG with a 1254×980 photo region and a 274px solid-black footer. The footer uses the exact catalog name in uppercase, centered bold condensed white type. Do not ask image generation to render this footer.
6. Visually inspect representative cards at full size. Regenerate any image with an incorrect brand, product variant, garbled label, cropped product, unreadable label, or inconsistent composition. For branded products, compare the generated package against its reference.
7. Run `npm run thumbs`, `npm run validate:strict`, `npm run type-check`, and `npm run build`. Do not finish with missing referenced files, stale thumbnails, or unrelated catalog changes.

## Card standards

- Source and final images are PNG files under `drinks/`.
- Keep the complete product visible. Prefer the full-product `fit: "fill"` treatment in the bundled builder over cover-cropping or blurred sidebars.
- Use the exact name from `drinks.json`; never abbreviate, rename, or hand-type a different footer label.
- Keep the current numeric `imageVariants` keys and regenerate derived thumbnails rather than rewriting catalog conventions.
- Replace an existing duplicate image when the requested drink already exists; do not create a second ID.
- Preserve unrelated user changes and do not add `_cat` entries.

## Builder usage

From the repository root, run:

```powershell
node .agents/skills/create-drink-cards/scripts/build-card.mjs <drink_id> <generated_photo_path>
```

The script reads the canonical name from `drinks.json` and writes `drinks/<drink_id>.png`.
