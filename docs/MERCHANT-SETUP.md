# Merchant setup and launch gate

## Install safely

Use a Shopify development/test store. Upload `FORME-Shopify-Theme.zip` to Online Store → Themes → Add theme → Upload ZIP. Keep it unpublished while configuring and testing it. The repository also supports Shopify's GitHub theme connection; the ignore file excludes source tooling. Do not overwrite a merchant's live theme.

## Load the fictional catalogue

Run `node scripts/export-catalog.mjs`. Review `docs/import/forme-products.csv` in a text editor or Shopify's import preview. Import it through Products → Import. Products are deliberately **draft and unpublished**. The CSV uses public repository image URLs; images must exist on `main` before import. Review Shopify's import mapping rather than overwriting existing products. Never import over an existing product with the same handle without a backup.

The import contains twelve products and 36 Arc variants. Keep Arc's option names and values exactly: Size = Compact / Generous / Chaise; Upholstery = Linen / Bouclé / Wool; Colour = Oat / Moss / Clay / Ink. Shopify assigns real IDs. The theme reads those IDs dynamically; do not paste fixture IDs into a store. Set the development store's currency to CAD before importing these illustrative prices, or convert the worksheet first.

CSV import is not a full store provisioning mechanism. Inventory at multiple locations requires Shopify's inventory import or admin inventory controls. Confirm that inventory tracking is enabled, inventory policy is deny, the Halo pendant is zero, and Chaise / Wool / Ink is zero at every eligible location. Other variants need positive inventory for the demo. Publish the reviewed products to the Online Store channel.

Create four product metafield definitions under Settings → Custom data → Products, all single-line text: `custom.tagline`, `custom.dimensions`, `custom.materials`, `custom.delivery`. The values for every product are supplied in `docs/import/metafield-values.json`. Edit those fields on each product. Assign the Arc sofa the `product.arc` theme template; keep other products on the default product template. Product media order controls the gallery; the opening Arc render depicts Generous/Oat/Linen, which the gallery caption states. Assign matching product-variant media when adding variant-specific photographs.

## Collections, filters and content

Create a collection of the twelve pieces, plus optional Sofas, Seating, Tables and Lighting collections. Enable product type, availability and price storefront filters in Shopify Search & Discovery. The collection form submits Shopify's native filter parameters; filters must be enabled in the store to affect results.

Open the Theme Editor. Set the homepage's Selected pieces collection. Set the Design studio product to Arc. Set Product information → Fabric sample product to The material library. For Shop this room, choose the four products, edit each label and reposition its X/Y markers against the image. Replace an image with an image-picker field; edit hero headings, editorial copy and card stories in their respective sections. Reorder or remove sections without code.

Create pages corresponding to `fixtures/pages.json` using the provided title and HTML content. Do **not** create the preview-only checkout-preview, order-confirmation or preview-guide pages in a live shop. Assign Compare to `page.compare` and Contact to `page.contact`; other pages use `page`. Menu/footer links use those handles. Create and select a navigation menu in the Header section. Set real business contact information and independently reviewed privacy, delivery, returns and terms policies before publication.

## Demonstrate a real Shopify test order

Configure a shipping zone/rate, inventory location and taxes appropriate to the test store. Enable a Shopify-supported test payment gateway or Shopify Payments test mode using Shopify's current documentation. Never test with real payment credentials. Choose Generous / Bouclé / Moss, copy its share link, open that link in another browser, check the selected options and price, add it to the bag, change quantity, and proceed to Shopify checkout. Complete a test payment; verify the actual order and its variant IDs in Shopify admin. Repeat an unavailable-variant attempt and a failed test payment. Disable test mode only when deliberately launching a reviewed real store.

Record the merchant editing Arc's price and product image in admin, then its content blocks in the Theme Editor. Reload the storefront and verify those changes without editing source files. This recording and the real test-order number remain deployment acceptance tasks until a store is connected.

## Important boundaries

The bundled furniture is fictional original design imagery, not evidence of real production, stock, warranties or sustainability certifications. Replace the illustrative delivery estimates and product claims with verified merchant data. Use commissioned real photography for actual products. Checkout customization beyond theme-to-checkout submission is governed by Shopify's checkout capabilities, not a Liquid checkout imitation.

References: https://shopify.dev/docs/storefronts/themes/architecture · https://shopify.dev/docs/api/ajax/reference/cart · https://help.shopify.com/en/manual/products/import-export/using-csv · https://help.shopify.com/en/manual/checkout-settings/test-orders
