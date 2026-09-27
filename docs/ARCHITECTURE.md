# Architecture and implementation decisions

## Progressive enhancement

Liquid renders navigation, product descriptions, images, prices, variant selects, collection forms and cart forms on the server. The standard product form includes a real `name="id"` variant select and quantity. JavaScript adds radio swatches, Ajax cart editing, comparison and an optional 3D viewer. Without JavaScript, the native Shopify product/cart/checkout forms remain available. The preview simulator requires JavaScript and is not a no-JavaScript commerce backend.

The theme's small core bundle loads once. The approximately 600 KB uncompressed Three.js module is loaded only after an explicit 3D request, followed by the chosen 1.2–1.6 MB GLB. No Three.js imports or model preloads run on collection or home pages. Product media uses responsive Shopify image URLs after a merchant uploads images.

## Commerce correctness

Every radio change resolves the exact combination from Shopify's product JSON and puts its real ID into the native form. The server owns price and availability. The client never invents a live price or creates a synthetic variant ID. The purchase handler captures its variant before awaiting the Ajax API. Cart updates are serialized and target line-item keys, preserving distinct properties. Inventory failures surface the server's message and retain the shopper's selection.

Share links contain Shopify's variant ID and retain locale paths. Invalid IDs fall back visibly to an available variant. Unavailable valid IDs remain unavailable rather than silently buying another finish. Comparison allows three validated handles and sanitizes all generated HTML/URLs; storage errors are handled.

## Rendering and lifecycle

Arc uses separate Compact, Generous and Chaise models, tailored cushion/piping geometry, a recessed walnut base, textile colour/roughness/normal maps, fabric sheen, environment lighting and contact shadows. Size loading uses a revision counter so an older response cannot overwrite the latest choice, including a return to a model already on screen. Rendering is on demand, suspended while hidden; resize, keyboard orbit, zoom, dimension overlays and camera reset are supported. Disposal frees geometry, materials, textures, environment maps, controls, events and renderer resources. Context loss produces a visible message, and failed loading leaves the normal gallery and purchase options usable.

## Preview separation

The development/static previews render the same Liquid templates with LiquidJS. `preview/adapter.js` replaces cart requests only in that explicitly labelled demonstration. Fixture products and simulated orders remain in the visitor's browser; contact/newsletter simulation neither sends nor saves the entered email. The installable ZIP excludes every preview file and fixture. No Shopify credentials, admin tokens, payment data or private account files are stored in this repository.

## Remaining deployment gates

Shopify platform rendering, filter configuration, catalogue import, actual test-gateway checkout, tax/shipping settings, merchant editing and live business policies need store-level acceptance. Structural validation and the browser-local suite do not certify these platform-side behaviours. Images are original renders, not photorealism certification. No unmeasured Lighthouse score, conversion uplift or accessibility certification is asserted.
