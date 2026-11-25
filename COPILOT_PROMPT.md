```text
You are helping me build and maintain a public GitHub repository called **drinkhud-catalog**.

Purpose:
- This repo stores and serves the **drink catalog** and **drink images** for the mobile app **DrinkHUD**.
- The DrinkHUD app is a React Native (Expo) app that lets users in loud bars or clubs silently show bartenders what drink they want.
- The app fetches `drinks.json` and related images from this repo through its **GitHub Pages site**, so everything here must be public, well-structured, and easy for the app to consume.

---

## 📁 Repository structure

```

drinkhud-catalog/
drinks/
margarita.png
old_fashioned.png
mojito.png
...
drinks/_thumbs/
margarita_512.png
margarita_1024.png
...
drinks.json
flags.json              # optional global flags (ex: "forceTextOnly")
scripts/
validate-catalog.ts   # validation script for consistency checks
.github/workflows/
build-thumbs.yml      # CI workflow to generate thumbnails with Sharp

````

---

## 🧩 drinks.json format

Each object must follow this shape:

```json
{
  "id": "margarita",
  "name": "Margarita",
  "category": "Classic",
  "aliases": ["Marg"],
  "popularity": 98,
  "imagePath": "drinks/margarita.png",
  "imageVariants": {
    "sm": "drinks/_thumbs/margarita_512.png",
    "md": "drinks/_thumbs/margarita_1024.png"
  },
  "modifiersSupported": ["no_ice", "double"]
}
````

Acceptance criteria:

1. Every `id` is unique and in lowercase snake_case.
2. `imagePath` and each `imageVariants` path point to existing files.
3. All thumbnails are auto-generated via a GitHub Action using **Sharp**.
4. The repo is published publicly as a GitHub Pages site (`main:/docs`), e.g.

   * `https://automationinferno.github.io/DrinkHUD-catalog/v1/drinks.json`
   * `https://automationinferno.github.io/DrinkHUD-catalog/img/v1/<id>_1024.<hash8>.webp`
5. The **DrinkHUD app** joins those paths with its Pages base and must load images without modification.
6. `scripts/validate-catalog.ts` ensures data consistency (unique ids, valid image paths, thumbs present).
7. Optional `flags.json` defines global feature flags, e.g.:

   ```json
   { "forceTextOnly": false, "catalogVersion": "0.1.0" }
   ```

---

## ⚙️ GitHub Action: build-thumbs.yml

This workflow:

1. Runs on each push to `main`.
2. Uses Node 20 + Sharp to generate `512 px` and `1024 px` thumbnails for every image in `/drinks/`.
3. Outputs them to `/drinks/_thumbs/`.
4. Commits and pushes the results if new thumbs were created.

---

## ✅ Desired state before integration with the app

* `drinks.json` exists and contains at least **50 classic drinks** with correct image paths.
* All images (`drinks/*.png`) and thumbnails (`drinks/_thumbs/*`) exist and match JSON paths.
* The CI workflow has successfully generated and committed the `_thumbs/` folder.
* Validation passes with no missing files or duplicate IDs.
* Everything can be fetched from the Pages site without CORS or 404 issues.

---

## 🧰 What I want you (Copilot) to do

1. Generate or update:

   * `drinks.json` (50–100 popular drinks with metadata and proper image paths).
   * `scripts/validate-catalog.ts` (Node + TypeScript script to check JSON and image consistency).
   * `.github/workflows/build-thumbs.yml` (Sharp-based thumbnail generator).
   * Optional `flags.json` with default values.
2. Make sure all paths and JSON fields exactly match what the **DrinkHUD app** expects.
3. Confirm that once committed, everything here can be loaded from
   `https://automationinferno.github.io/DrinkHUD-catalog/v1/drinks.json`
   and used by the app with no code changes.

Use clean, TypeScript-friendly code and ensure this repo is production-ready as the public catalog and asset source for the DrinkHUD mobile app.

```

---

✅ Usage:
1. Open your `drinkhud-catalog` repo in VS Code.  
2. Open **Copilot Chat**, select **GPT-5** (or GPT-4.1).  
3. Paste the prompt above.  
4. Then ask follow-ups like:  
   - “Generate the `.github/workflows/build-thumbs.yml` file.”  
   - “Create `scripts/validate-catalog.ts` to verify the JSON and images.”  
   - “Seed a starter `drinks.json` with 50 classic cocktails.”  

This will keep the catalog repo perfectly aligned with your DrinkHUD app’s expectations.

