// setup/create-products.mjs
// Run this ONCE to populate your Shopify dev store with Arcwood products.
// Usage: node --env-file=.env.local setup/create-products.mjs

const DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN  = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

if (!DOMAIN || !TOKEN) {
  console.error("❌  Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN in .env.local");
  process.exit(1);
}

async function gql(query, variables = {}) {
  const res = await fetch(`https://${DOMAIN}/admin/api/2024-10/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

const PRODUCTS = [
  {
    title: "Ember Lounge Chair",
    handle: "ember-lounge-chair",
    descriptionHtml: "<p>A mid-century inspired lounge chair with solid walnut frame and hand-stitched leather upholstery. Available in cognac, charcoal, and ivory.</p>",
    productType: "Seating",
    tags: ["lounge", "leather", "walnut", "mid-century"],
    variants: [
      { price: "1290.00", sku: "ELC-COG", inventoryQuantities: [{ availableQuantity: 12, locationId: "" }], optionValues: [{ name: "Cognac", optionName: "Color" }] },
      { price: "1290.00", sku: "ELC-CHA", inventoryQuantities: [{ availableQuantity: 8,  locationId: "" }], optionValues: [{ name: "Charcoal", optionName: "Color" }] },
      { price: "1290.00", sku: "ELC-IVO", inventoryQuantities: [{ availableQuantity: 5,  locationId: "" }], optionValues: [{ name: "Ivory", optionName: "Color" }] },
    ],
    metafields: [
      { namespace: "custom", key: "dimensions",        value: 'W 31" × D 34" × H 32" | Seat height: 17"', type: "single_line_text_field" },
      { namespace: "custom", key: "weight_capacity",   value: "300 lbs",                                   type: "single_line_text_field" },
      { namespace: "custom", key: "assembly_required", value: "No — ships fully assembled",                type: "single_line_text_field" },
      { namespace: "custom", key: "lead_time",         value: "Ships in 3–5 business days",                type: "single_line_text_field" },
      { namespace: "custom", key: "material",          value: "Solid walnut frame, full-grain leather, high-density foam", type: "single_line_text_field" },
      { namespace: "custom", key: "care",              value: "Wipe with dry cloth. Condition leather every 6 months.",    type: "single_line_text_field" },
      { namespace: "custom", key: "is_custom",         value: "false",                                     type: "single_line_text_field" },
    ],
  },
  {
    title: "Drift Dining Table",
    handle: "drift-dining-table",
    descriptionHtml: "<p>A live-edge white oak dining table on a blackened steel base. Each table is unique — exact grain pattern and natural edge will vary.</p>",
    productType: "Tables",
    tags: ["dining", "live-edge", "oak", "steel"],
    variants: [
      { price: "2850.00", sku: "DDT-72", inventoryQuantities: [{ availableQuantity: 4, locationId: "" }], optionValues: [{ name: '72"', optionName: "Size" }] },
      { price: "3200.00", sku: "DDT-84", inventoryQuantities: [{ availableQuantity: 3, locationId: "" }], optionValues: [{ name: '84"', optionName: "Size" }] },
    ],
    metafields: [
      { namespace: "custom", key: "dimensions",        value: '72" L × 36" W × 30" H (seats 6–8)',        type: "single_line_text_field" },
      { namespace: "custom", key: "assembly_required", value: "Yes — base attaches to tabletop (30 min, tools included)", type: "single_line_text_field" },
      { namespace: "custom", key: "lead_time",         value: "Ships in 2–3 weeks (live-edge sourcing)",   type: "single_line_text_field" },
      { namespace: "custom", key: "material",          value: "Live-edge white oak, blackened steel base", type: "single_line_text_field" },
      { namespace: "custom", key: "care",              value: "Oil with wood conditioner every 6 months. Avoid standing water.", type: "single_line_text_field" },
      { namespace: "custom", key: "is_custom",         value: "false",                                     type: "single_line_text_field" },
    ],
  },
  {
    title: "Cove Sectional Sofa",
    handle: "cove-sectional-sofa",
    descriptionHtml: "<p>A modular sectional built to your exact dimensions and fabric choice. Choose from 40+ fabric options and configure left or right chaise. <strong>Custom/built-to-order — not eligible for return.</strong></p>",
    productType: "Sofas",
    tags: ["sectional", "custom", "built-to-order", "modular"],
    variants: [
      { price: "3400.00", sku: "CSS-LCH", inventoryQuantities: [{ availableQuantity: 99, locationId: "" }], optionValues: [{ name: "Left Chaise", optionName: "Configuration" }] },
      { price: "3400.00", sku: "CSS-RCH", inventoryQuantities: [{ availableQuantity: 99, locationId: "" }], optionValues: [{ name: "Right Chaise", optionName: "Configuration" }] },
    ],
    metafields: [
      { namespace: "custom", key: "dimensions",        value: 'Configurable — standard 110" × 90" L-shape', type: "single_line_text_field" },
      { namespace: "custom", key: "assembly_required", value: "Yes — sections connect (15 min)",             type: "single_line_text_field" },
      { namespace: "custom", key: "lead_time",         value: "8–10 weeks (custom build)",                   type: "single_line_text_field" },
      { namespace: "custom", key: "material",          value: "Kiln-dried hardwood frame, sinuous spring base, fabric of choice", type: "single_line_text_field" },
      { namespace: "custom", key: "care",              value: "Varies by fabric — refer to care tag on your unit", type: "single_line_text_field" },
      { namespace: "custom", key: "is_custom",         value: "true",                                        type: "single_line_text_field" },
    ],
  },
  {
    title: "Slab Coffee Table",
    handle: "slab-coffee-table",
    descriptionHtml: "<p>A solid concrete coffee table with a polished top and raw sides. Substantial, minimal, and pairs with almost anything.</p>",
    productType: "Tables",
    tags: ["coffee-table", "concrete", "minimal"],
    variants: [
      { price: "680.00", sku: "SCT-NAT", inventoryQuantities: [{ availableQuantity: 10, locationId: "" }], optionValues: [{ name: "Natural", optionName: "Finish" }] },
      { price: "680.00", sku: "SCT-CHR", inventoryQuantities: [{ availableQuantity: 6,  locationId: "" }], optionValues: [{ name: "Charred", optionName: "Finish" }] },
    ],
    metafields: [
      { namespace: "custom", key: "dimensions",        value: '48" L × 24" W × 16" H',                  type: "single_line_text_field" },
      { namespace: "custom", key: "assembly_required", value: "No",                                       type: "single_line_text_field" },
      { namespace: "custom", key: "lead_time",         value: "Ships in 5–7 business days (freight)",    type: "single_line_text_field" },
      { namespace: "custom", key: "material",          value: "Reinforced concrete, sealed surface",      type: "single_line_text_field" },
      { namespace: "custom", key: "care",              value: "Seal annually. Blot spills immediately — concrete is porous.", type: "single_line_text_field" },
      { namespace: "custom", key: "is_custom",         value: "false",                                    type: "single_line_text_field" },
    ],
  },
];

// First, get the default location ID (needed for inventory)
async function getLocationId() {
  const data = await gql(`{ locations(first: 1) { edges { node { id name } } } }`);
  const loc = data.locations.edges[0]?.node;
  if (!loc) throw new Error("No locations found in store");
  console.log(`📍 Using location: ${loc.name} (${loc.id})`);
  return loc.id;
}

const CREATE_PRODUCT = `
  mutation CreateProduct($input: ProductInput!) {
    productCreate(input: $input) {
      product { id title handle }
      userErrors { field message }
    }
  }
`;

async function createProduct(product, locationId) {
  // Inject locationId into inventory quantities
  const input = {
    ...product,
    variants: product.variants.map((v) => ({
      ...v,
      inventoryQuantities: v.inventoryQuantities.map((iq) => ({
        ...iq,
        locationId,
      })),
    })),
  };

  const data = await gql(CREATE_PRODUCT, { input });
  const { product: created, userErrors } = data.productCreate;

  if (userErrors.length) {
    console.error(`  ❌  ${product.title}:`, userErrors.map((e) => e.message).join(", "));
    return null;
  }

  console.log(`  ✅  ${created.title} → ${created.id}`);
  return created;
}

// Also create a couple of test orders
const CREATE_ORDER = `
  mutation draftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder { id name }
      userErrors { field message }
    }
  }
`;

async function main() {
  console.log(`\n🏠 Arcwood Dev Store Setup`);
  console.log(`   Store: ${DOMAIN}\n`);

  const locationId = await getLocationId();

  console.log("\n📦 Creating products...");
  const created = [];
  for (const product of PRODUCTS) {
    const result = await createProduct(product, locationId);
    if (result) created.push(result);
    await new Promise((r) => setTimeout(r, 300)); // rate limit courtesy
  }

  console.log(`\n✅ Done. ${created.length}/${PRODUCTS.length} products created.`);
  console.log("\nProduct IDs (update MOCK_PRODUCTS in lib/shopify.ts if needed):");
  created.forEach((p) => console.log(`  ${p.handle}: ${p.id}`));

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Next steps:
1. Go to your store admin → Orders → Create order
   Make a test order for "Ember Lounge Chair" with email test@example.com
   Mark as paid. Note the order number (e.g. #1001).

2. Update your .env.local:
   SHOPIFY_STORE_DOMAIN=${DOMAIN}
   SHOPIFY_ADMIN_ACCESS_TOKEN=<already set>

3. Run: npm run dev
   The UI will show "Live Shopify data" in the sidebar.

4. Try: "I want to check my order #1001, test@example.com"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
