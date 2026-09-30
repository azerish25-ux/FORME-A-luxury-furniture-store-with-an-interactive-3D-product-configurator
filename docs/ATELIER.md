# FORME / Atelier

A coordinated storefront and furniture-art revision. Native Shopify Liquid remains the product, variant and cart authority. The preview remains a plainly labelled simulation with no payment collection.

## The visual system

Warm mineral surfaces, a deep olive primary role, Instrument Serif display typography and DM Sans shopping controls. The homepage now has an architectural room hero, a product plaque linked to the shown configuration, a coordinated collection, an interactive four-colour Arc study, material stories, a shoppable room and a quieter dark footer. Product pages, collection filters, comparison and the bag inherit the same shapes, selected states, focus treatment and surface hierarchy.

The adaptation uses Google's [Material colour roles](https://material-web.dev/theming/color/), [brand/plain typography roles](https://material-web.dev/theming/typography/) and [button emphasis](https://material-web.dev/components/button/). It is not a Material certification or an unmodified Material component library. `assets/atelier.css` is the role-to-component implementation; this adds no UI framework dependency.

## Art, not stock photography

- **Arc, all three sizes:** more pronounced upholstery crown, two independently shaped and tilted lumbar cushions, inset welts and additional recessed timber joins. The scene and WebGL viewer use the same geometry. The three original physical footprints and all 36 variant IDs are unchanged.
- **Vale:** a continuously swept horseshoe shell, crowned seat, lumbar cushion, welts and exposed timber sled construction replace the old elementary forms.
- **Monolith:** a multi-ring elliptical bullnose top and rounded stone pedestals, with layered travertine and pore shading.
- **Lumen:** 96 physically modelled linen pleats, an inner shade wall, bindings, stem, weighted turned base and finial.
- **The room:** the actual Generous/Linen/Moss Arc and these companion pieces in a purpose-built plaster/limestone interior, with real light sources, sculptural wall art, books and an open ceramic vessel.

Other catalogue models retain their earlier authoring. Companion GLBs are review models; only Arc has interactive storefront configuration. Procedural stone and lamp shaders are authored for Cycles; their simple glTF material exports do not reproduce every procedural detail. No claim of photographic evidence, manufacturing accuracy or a real furniture business is made.

`tools/Arc-master.blend` and `tools/Atelier-master.blend` are editable, packed scene sources. `tools/arc-assets.py` and `tools/atelier-assets.py` are the reproducible modelling sources. Texture generation is deterministic. The Arc prefix stays `arc-v2-` because the established data contract remains version 2; file hashes identify this art revision.

## Interaction and delivery

Homepage swatches are generated from real Liquid variants, not calculated IDs. Choosing Moss in the colour study opens the exact Generous/Linen/Moss product configuration. The initial Oat link also matches its poster without JavaScript. The hero plaque resolves the Moss variant from the merchant's actual Arc product.

Daylight and Warm light change only the viewer's presentation. They cannot alter variant selection, prices or inventory. The renderer remains on-demand, pauses when hidden, supports keyboard camera controls, disposes GPU resources and keeps a gallery fallback. The homepage never downloads the configurator bundle or any GLB.

All 36 Arc posters have full-size and 720-pixel derivatives. The Atelier pack produces five WebP images and five 900-pixel derivatives. Merchant-selected image assets continue through Shopify's responsive `image_tag`; no custom CMS or pricing backend is introduced.

## Design handoff and the Figma limitation

The connected Figma tool created [FORME — Material Atelier / Storefront & 3D](https://www.figma.com/design/5atAdKuDsZqsW8uyVw6sRP). Its next canvas call was blocked by the account's Starter-plan MCP limit. **That file is blank; it is not evidence of a completed Figma redesign.**

`design/atelier-home-desktop.svg`, `design/atelier-home-mobile.svg` and `design/atelier-product-desktop.svg` are editable handoff boards. Their typography, surfaces and controls are separate SVG elements; only product CGI is a content image. They can be imported into a design editor, but have not been verified through a Figma import. They are composition studies, not a substitute for the responsive Liquid implementation or published Figma components. `design/atelier-tokens.json` carries the actual CSS roles. No font files are embedded or distributed.

## Reproduce

Use Node 22, Python 3 with Pillow 11.3.0 / numpy 2.2.6, and Blender 4.5 or newer. Local authoring was exercised in Blender 5.2.2 LTS. CI uses the existing checksum-verified Blender 4.5.3 toolchain.

```sh
npm ci
python tools/arc-materials.py
blender -b -t 4 --python tools/arc-assets.py -- --mode all --samples 48 --width 1440
blender -b -t 4 --python tools/atelier-assets.py -- --mode all --samples 48 --width 1800
python tools/arc-pack.py --strict
python tools/atelier-pack.py
python tools/atelier-design.py
npm run build
npm run typecheck
npm test
npm run check
npm run verify:arc
npm run verify:atelier
npx playwright install chromium firefox webkit
npm run test:e2e
node scripts/export-catalog.mjs
npm run package
node scripts/static-preview.mjs
npm run test:static
```

`--fabric` and `--size` split Arc rendering into independent jobs without changing the geometry or material source. Strict packing refuses to substitute a different configuration for a missing render.

## Evidence and scope

The acceptance workflow checks source/asset hashes, dimensions, model size and triangle budgets, native-theme structure, configuration/cart regressions and browser accessibility. Atelier browser tests cover 360/390/768/1440 widths, actual variant navigation, no eager WebGL, and lighting/commerce isolation. Refer to a specific successful run, not this document alone, for pass status.

The existing ChatGPT Site is a separate deployment: committing this revision does not publish it there. Real Shopify checkout and merchant-editor testing still require an authorized development store. This revision does not claim either has been completed.
