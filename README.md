# BarSignal-catalog
Catalog of drinks for BarSignal

## Privacy Policy

The browser-friendly policy is [`docs/privacy-policy.html`](docs/privacy-policy.html).
Its intended public URL after GitHub Pages deployment is:

https://automationinferno.github.io/BarSignal-catalog/privacy-policy.html

The BarSignal app URL change is prepared separately. Do not release it or
change the Play Console privacy-policy field until the page is live and verified.

The canonical editable policy source remains
[`docs/privacy-policy.md`](docs/privacy-policy.md), and older app links still
open it via jsDelivr:

https://cdn.jsdelivr.net/gh/automationinferno/BarSignal-catalog@main/docs/privacy-policy.md

Keep this path available until the app and Play Console both point at the live
HTML page.

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
The drink catalog and image URLs continue using jsDelivr unchanged.

### Maintaining the policy

[`docs/privacy-policy.md`](docs/privacy-policy.md) is the editable policy source
and fallback for older app versions. The HTML is currently maintained manually;
update both documents together,
including the last-updated date when the policy changes. Prefer stacked
headings and paragraphs over tables, and check phone widths, enlarged text,
light/dark mode, and links before publishing.
