# Arc Experience V2

## Scope and product truth

The native Shopify Liquid theme remains the storefront. This milestone replaces Arc's product experience, not the entire FORME collection. Real Shopify variant IDs, availability and prices remain authoritative. The standalone preview is a browser-local demonstration and accepts no payment.

`tools/arc-spec.json` owns supported option names, three sizes, three materials, four colours, model names and physical dimensions. `scripts/generate-arc.mjs` generates the Liquid manifest, selected-poster and measurement snippets, and fixture media mapping. Do not manually edit those generated snippets. Every one of the 36 configurations has an individually rendered 1440px poster and a 720px derivative. Gallery alternatives identify their actual finish. The bag uses the selected configuration's image; share links retain the native variant ID. Unknown merchant configurations are not silently assigned a different sofa.

Native installation still requires importing the media and assigning variant images. `node scripts/export-catalog.mjs` produces a DRAFT worksheet with Variant Image values and no fixture IDs. Review it against the real catalogue before import; changing option values in an existing Shopify import can recreate variant IDs. No store import, merchant-editor session or test checkout has been performed by these scripts.

## Interaction and typography

The product page provides dimensioned size cards, material sample images, labelled colour choices, a non-WebGL measurement diagram, an enlarged keyboard-operable gallery and a mobile purchase summary that appears after the primary purchase row. The image and buying controls share a responsive grid. Shopping text is no longer dependent on 8–11px captions; semantic display/body/control/caption styles live in `assets/arc-experience.css` over the existing theme.

The optional 3D view loads only on request, fits each model to the viewport, offers angle/front/side/detail views and explicit rotate/zoom controls, preserves keyboard operation, and falls back to gallery purchasing if resources fail. It renders on demand rather than running an idle animation loop. It does not assert device-specific FPS or field performance.

## State and commerce

`src/product.js` owns product/gallery state. `src/arc-state.js` resolves the validated configuration contract. `src/cart-state.js` serializes authoritative server requests while preserving the latest intended quantity; repeated clicks no longer compute the same stale absolute count. It reconciles rejected updates without blindly retrying a non-idempotent add. `src/cart-dom.js` retains keyed controls, focus and delivery-note drafts. `src/cart.js` coordinates the actual Ajax endpoints and waits for pending updates before checkout. Shared dialogs and announcement utilities live in `src/dom.js`.

Native forms remain present. Preview-only code stays out of the installable Shopify archive. The preview adapter consumes the same configuration mapping and listens for the post-update checkout event; it never creates a real order.

## Original asset pipeline

- `python tools/arc-materials.py`: deterministic original linen, bouclé, wool and walnut colour/roughness/tangent-normal maps. No downloaded photographic textures.
- `blender -b -t 4 --python tools/arc-assets.py -- --mode models`: separately built Compact, Generous and Chaise geometry, physical-scale UVs, embedded maps and packed editable `tools/Arc-master.blend`.
- `blender -b -t 4 --python tools/arc-assets.py -- --mode posters --size Compact --samples 48 --width 1440`: 12 posters; repeat for Generous and Chaise.
- `blender -b -t 4 --python tools/arc-assets.py -- --mode details --samples 64 --width 1440`: front/profile, seam, walnut and three material studies.
- `python tools/arc-pack.py --strict`: encode only completed matching renders and write the source/resource SHA-256 manifest. `--partial` is only for in-progress local review, never release.
- `npm run verify:arc`: independently inspect GLB bounds, UVs, images, budgets, all configuration derivatives and source/resource integrity.

Blender 4.5.3 is pinned and checksum-verified in CI. Blender 5.2.2 was used for local authoring. Rendering is CGI of a fictional original product, not documentary photography or certification of manufacturability. Declared centimetres are 224×103×83, 284×103×83 and 304×182×83; the independent export tolerance is 0.6cm. Visual review must evaluate shape, construction and material response, not just triangle count.

## Verification and release

Run `npm ci`, `npm run build`, `npm run typecheck`, `npm test`, `npm run check`, `npm run verify:arc`, `npm run test:e2e` and `npm run package`. Browser tests require `npx playwright install --with-deps chromium firefox webkit`. The original journeys remain; additional coverage includes all 36 shared configurations, cart intent/focus/notes, stale posters, independent measurements, gallery focus, first-load material switching, responsive composition and dialog accessibility. Firefox and WebKit run the non-WebGL commerce slice. Screenshots are captured for visual review; they are not visual-baseline assertions or comprehensive accessibility certification.

The manual asset-production workflow pins and verifies Blender, produces all configurations, then independently verifies the derivatives in a separate job. It is artifact-only: no render job can push over source or overwrite approved assets. Normal read-only quality CI uses the committed lockfile, checks generated-file drift, asset hashes, native Theme Check, all three browser engines and the packaged static preview. Source/theme/preview archives are produced after acceptance. The separate GitHack preview publisher is manual pending host-specific parity work; a GitHub commit is not a deployment to the supplied ChatGPT Site.

## Remaining roadmap

Homepage art direction, the other product families, full collection/comparison refinements, editorial content expansion, Figma canvas synchronization, real-device GPU measurements and authorized Shopify-store activation remain separate work. This milestone does not claim that all 22 audit findings or the entire site redesign are complete.

## Acceptance repairs

Pending removals use aria-disabled controls without discarding keyboard focus; repeat activation is suppressed until the server settles. Reconciliation restores a remaining quantity control, or the shopping link for an empty bag. Tests include keyed reordering, delayed removal and last-line removal. Mobile purchase tests explicitly pass the original purchase row, then verify the sticky action, modal suppression and return-to-top behavior. Cart-page locators exclude the hidden drawer duplicate.

LiquidJS is pinned to 10.29.0 and the isolated fixture renderer uses ownPropertyOnly. Dependency auditing fails release checks for high/critical advisories. The development renderer does not accept uploaded/untrusted templates. Google-hosted fonts remain; no local font binaries are redistributed.

The mobile purchase bar also handles direct jumps between off-screen positions, which an intersection-only observer cannot distinguish. A passive scroll/resize controller performs one scheduled geometry read, cleans up on unmount, and preserves focus on the actual sticky purchase trigger when the bag closes. Dedicated browser regressions cover direct jumps and disposal.
