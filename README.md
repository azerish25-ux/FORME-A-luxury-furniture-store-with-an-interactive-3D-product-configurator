# FORME — Objects for living

An original, editorial furniture storefront built as a **native Shopify Online Store 2.0 Liquid theme**. No React storefront, headless checkout replacement or production mock-commerce service is used.

The design pairs warm ivory, olive-grey and charcoal with large serif typography, quiet editorial compositions and an original Blender-authored furniture collection. Arc is a genuinely modelled sofa system with separately authored Compact, Generous and Chaise geometry, not one stretched primitive.

## Run locally

Node.js 22 and Python 3 are required for the development and packaging scripts.

```sh
npm ci
npm run build
npm test
npm run check
npm run preview
```

Open `http://localhost:4173`. The development server renders the actual Liquid sections against isolated fictional product fixtures. It is **not a Shopify server**. A visible banner and checkout warning distinguish its browser-local order simulation from Shopify test mode.

```sh
npx playwright install chromium
npm run test:e2e
npm run package
node scripts/export-catalog.mjs
node scripts/static-preview.mjs
```

The installable archive is `artifacts/FORME-Shopify-Theme.zip`. It contains only theme directories, not fixture data or the preview adapter. Follow [the merchant setup guide](docs/MERCHANT-SETUP.md) to install it on an unpublished development-store theme.

## What is implemented

Collection filtering and sorting; product galleries and native variant forms; a lazily loaded Three.js Arc configurator; actual variant IDs and server prices in the native cart; unavailable configurations; shareable `?variant=` links; Ajax cart editing and persistence through Shopify; native hosted checkout submission; a fabric-sample product; persistent comparison of up to three products; four merchant-positionable shoppable-room markers; product/editorial pages; native newsletter/contact forms; responsive and keyboard-accessible controls.

Arc has **36 fixture variants**: three sizes × three fabrics × four colours. Changing upholstery or size selects a different variant and price. One configuration and the Halo pendant demonstrate out-of-stock handling. The original model bounds are approximately Compact 224 × 103 × 83 cm, Generous 284 × 103 × 83 cm and Chaise 304 × 182 × 83 cm. These are rounded model measurements, not manufacturing drawings.

## Native theme versus portfolio preview

| Concern | Installed Shopify theme | Standalone portfolio preview |
|---|---|---|
| Product/variant data | Shopify Liquid product objects | Fictional fixture catalogue |
| Price/inventory authority | Shopify Ajax Cart API | Browser-local simulator |
| Checkout | Shopify hosted checkout | Explicitly labelled simulation; no payment fields |
| Order confirmation | Shopify's own checkout/order pages | Browser-local demonstration only |
| Contact/newsletter | Shopify native forms | Validates input; does not submit or save it |
| Merchant editing | Shopify Theme Editor and product admin | Not simulated as a real merchant admin |

**A real Shopify test order and merchant-editor recording have not been verified without an attached Shopify development store.** The preview must not be presented as that evidence. No payments are accepted by the preview.

## Source map

`layout/`, `sections/`, `snippets/`, `templates/`, `config/`, `locales/`: native theme. `src/theme.js`: commerce and progressive enhancement. `src/configurator.js`: on-demand PBR viewer with context-loss handling and disposal. `src/core.js`: testable variant, quantity, URL and comparison logic. `tools/build_assets.py`: reproducible original geometry and Cycles renders. `tools/Arc-master.blend`: original editable sofa. `preview/`, `fixtures/`, `scripts/liquid-renderer.mjs`: isolated demonstration adapter. `tests/`: domain and browser regression tests.

Read [asset provenance](docs/ASSET-PROVENANCE.md), [architecture](docs/ARCHITECTURE.md) and [the acceptance checklist](docs/ACCEPTANCE.md) before presenting or publishing the store.
