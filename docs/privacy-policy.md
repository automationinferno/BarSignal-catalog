# Privacy Policy for BarSignal

**Last updated**: 2026-09-09

BarSignal ("the App") is provided by automationinferno ("we," "us," or "our").
This Privacy Policy explains how the App handles information when you use it.

## Information the App processes

BarSignal is designed to be a lightweight, offline-capable drink-reference tool.
It does **not** collect, store, or transmit any personally identifiable
information (PII) to us or to any third-party service we control.

The App processes the following information **exclusively on your device**:

| Category | Details | Purpose |
|---|---|---|
| **Favorites & settings** | Your favorite drinks, theme preference (light/dark/auto), haptic-feedback toggle, high-contrast toggle, and text-only toggle. | Persist your preferences across app launches. |
| **Drink catalog cache** | A local copy of the drink catalog (names, ingredients, steps, image URLs). | Enable offline use and reduce network requests. |
| **Image disk cache** | Cached drink images downloaded from the catalog CDN. | Improve load performance and support offline browsing. |
| **Ad-frequency counter** | A counter that tracks how many drink selections you have made, used to decide when to show an opt-in interstitial ad. | Respect ad-frequency caps without collecting any personal data. |

All of the above data is stored locally using the standard device storage APIs
(AsyncStorage and the Expo/React Native file-system cache). **It never leaves
your device** unless you choose to clear it from the Settings screen.

## Advertising & Google AdMob

BarSignal displays **interstitial advertisements** served by Google AdMob.
AdMob may collect and use the following data in accordance with its own
[Privacy Policy](https://policies.google.com/privacy):

- **Device advertising identifier** (AAID on Android / IDFA on iOS)
- **IP address** (used for geo-targeting and fraud prevention)
- **App interaction data** (ad views, clicks) for measurement and reporting

We use Google's **User Messaging Platform (UMP)** to obtain your consent for
personalized advertising in regions where it is required by law (e.g. EEA, UK,
California). When the consent form is presented, you can:

- **Consent** to personalized ads
- **Decline** and receive non-personalized ads instead
- **Manage** your choices at any time via **Settings → Privacy Choices**

If you decline personalized ads, AdMob still serves ads but does not use your
advertising identifier for personalization.

We do **not** receive, store, or have access to your advertising identifier,
consent string, or any raw AdMob data. All ad-related data processing is
handled directly between Google and your device.

## Third-party services

The App makes network requests to the following third-party services:

| Service | Purpose | Data transmitted |
|---|---|---|
| **jsDelivr CDN** (`cdn.jsdelivr.net`) | Fetch the drink catalog JSON and drink images | None — standard HTTP requests |
| **Google AdMob** | Serve interstitial ads and manage consent | Advertising ID, IP address (see above) |

## Data retention & deletion

All locally stored data (favorites, settings, catalog cache, image cache,
ad-frequency counter) can be cleared at any time from **Settings**:

- **Clear Catalog Cache** — removes the cached drink catalog
- **Clear Image Cache** — removes cached drink images

Uninstalling the App removes all locally stored data permanently.

## Children's privacy

BarSignal is not directed at children under the age of 13 (or the applicable
age of digital consent in your region). We do not knowingly collect personal
information from children.

## Changes to this policy

We may update this Privacy Policy from time to time. Changes will be posted
at this URL and the "Last updated" date will be revised. Significant changes
may be communicated through the App or the Play Store listing.

## Contact

If you have questions about this Privacy Policy, please open an issue at
[github.com/automationinferno/BarSignal](https://github.com/automationinferno/BarSignal)
or contact us at the email address listed on the Play Store listing.