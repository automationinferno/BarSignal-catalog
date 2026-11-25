# DrinkHUD-catalog
Catalog of drinks for DrinkHUD

## Privacy Policy

The browser-friendly policy is [`docs/privacy-policy.html`](docs/privacy-policy.html).
Its public URL is:

https://automationinferno.github.io/DrinkHUD-catalog/privacy-policy.html

The canonical editable policy source remains
[`docs/privacy-policy.md`](docs/privacy-policy.md), published alongside it at:

https://automationinferno.github.io/DrinkHUD-catalog/privacy-policy.md

The repository was renamed from `BarSignal-catalog` on 2026-11-25, so the previous
jsDelivr URLs keyed on the old name no longer resolve. Keep both policy files in
`docs/` so the Pages URLs above stay available, and point the app and the Play Console
privacy-policy field at the HTML page.

### Publishing

1. Merge the catalog changes into `main`.
2. In GitHub, open **Settings / Pages / Build and deployment**.
3. Select **Deploy from a branch**, branch `main`, and folder `/docs`.
4. Wait for the Pages deployment to succeed. Verify the URL above returns
   HTTP 200 with `Content-Type: text/html` and opens correctly on a phone.
5. Update **Play Console / Policy / App content / Privacy policy**, then
   merge and release the app URL change.

`docs/.nojekyll` makes Pages serve the files as-is, without a Jekyll build.
No custom workflow, JavaScript, external fonts, or analytics are needed for the page.
Builds released before the switch to the [catalog site](#catalog-site-github-pages)
fetched the root `drinks.json` through jsDelivr on the old repository name, which stopped
resolving when the repository was renamed; those builds fall back to their bundled
catalog. Keep the root `drinks.json` and `drinks/` paths stable anyway: the generated
Pages site is derived from them.

### Maintaining the policy

[`docs/privacy-policy.md`](docs/privacy-policy.md) is the editable policy source
and fallback for older app versions. The HTML is currently maintained manually;
update both documents together,
including the last-updated date when the policy changes. Prefer stacked
headings and paragraphs over tables, and check phone widths, enlarged text,
light/dark mode, and links before publishing.

## Catalog site (GitHub Pages)

The same Pages site (`main:/docs`, https://automationinferno.github.io/DrinkHUD-catalog/)
also serves a generated copy of the catalog and its images, so app builds that use it no
longer depend on jsDelivr (jsDelivr intermittently returns HTTP 403 for this repository,
which exceeds its 50 MB package limit). `scripts/build-site.js` generates it:

- `/v1/drinks.json` (`docs/v1/drinks.json`): the root `drinks.json` with the same drinks,
  order and fields. Only `imagePath` and `imageVariants` are rewritten, to `img/v1/…`
  paths relative to the site root.
- `/img/v1/<id>_<512|1024>.<hash8>.webp` (`docs/img/v1/`): WebP images encoded from each
  drink's source image (its root `imagePath`, `drinks/<id>.png`), not from
  `drinks/_thumbs/`. The 512 file backs `imageVariants["512"]` and `["thumb"]`; the 1024
  file backs `["1024"]` and `imagePath`. `hash8` comes from the source bytes and the
  encoding settings, so a changed image gets new file names.

After changing `drinks.json` or a source image in `drinks/`, run `npm run build:site`
(it needs sharp from `npm ci`) and commit `docs/` with the change. The build encodes only
missing images, rewrites `docs/v1/drinks.json` only when it changes, and ends with the
site check. `npm run check:site` runs that check alone, offline and without an install:
the required `docs/.nojekyll` and privacy-policy files, drift from `drinks.json`, file
names and hashes, exact 512×512 / 1024×1024 image sizes (read from the header of every
file in `docs/img/v1/`), and the size budgets listed at the top of `scripts/build-site.js`.
`.github/workflows/check-site.yml` runs `npm test`, `npm run validate:strict` and
`npm run check:site` on every pull request and on pushes to `main`, plus the append-only
guard below on pull requests; Pages itself publishes `main:/docs`, with no deploy
workflow.

Generated images are append-only. Never rename, overwrite or delete files in
`docs/img/v1/`, including ones the current `docs/v1/drinks.json` no longer references,
because released app builds may still reference them. On pull requests CI enforces this:
it fails if the PR deletes, modifies, renames or changes the type of any existing file
under `docs/img/` (direct pushes to `main` are not checked). Never edit
`docs/v1/drinks.json` by hand, and never delete `docs/.nojekyll`; `check:site` fails on
both.
