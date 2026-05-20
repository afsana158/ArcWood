// lib/shopify.ts
// Thin Shopify Admin GraphQL client.
// Falls back to mock data when SHOPIFY_* env vars are not set (development / demo mode).

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_TOKEN  = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

export const USE_MOCK = !SHOPIFY_DOMAIN || !SHOPIFY_TOKEN;

// ─── GraphQL client ───────────────────────────────────────────────────────────

export async function shopifyQuery<T = unknown>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  if (USE_MOCK) throw new Error("USE_MOCK — caller should not reach shopifyQuery");

  const url = `https://${SHOPIFY_DOMAIN}/admin/api/2024-10/graphql.json`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_TOKEN!,
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Shopify HTTP ${res.status}`);
    const json = await res.json();
    if (json.errors?.length) throw new Error(json.errors[0].message);
    return json.data as T;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Mock store data ──────────────────────────────────────────────────────────

export const MOCK_PRODUCTS = [
  {
    id: "gid://shopify/Product/1",
    title: "Ember Lounge Chair",
    handle: "ember-lounge-chair",
    description: "A mid-century inspired lounge chair with solid walnut frame and hand-stitched leather upholstery. Available in cognac, charcoal, and ivory.",
    priceRange: { minVariantPrice: { amount: "1290.00", currencyCode: "USD" } },
    metafields: [
      { key: "dimensions", value: "W 31\" × D 34\" × H 32\" | Seat height: 17\"" },
      { key: "weight_capacity", value: "300 lbs" },
      { key: "assembly_required", value: "No — ships fully assembled" },
      { key: "lead_time", value: "Ships in 3–5 business days" },
      { key: "material", value: "Solid walnut frame, full-grain leather, high-density foam" },
      { key: "care", value: "Wipe with dry cloth. Condition leather every 6 months." },
      { key: "is_custom", value: "false" },
    ],
  },
  {
    id: "gid://shopify/Product/2",
    title: "Drift Dining Table",
    handle: "drift-dining-table",
    description: "A live-edge white oak dining table on a blackened steel base. Each table is unique — exact grain pattern and natural edge will vary.",
    priceRange: { minVariantPrice: { amount: "2850.00", currencyCode: "USD" } },
    metafields: [
      { key: "dimensions", value: "72\" L × 36\" W × 30\" H (seats 6–8)" },
      { key: "weight_capacity", value: "N/A — dining surface" },
      { key: "assembly_required", value: "Yes — base attaches to tabletop (30 min, tools included)" },
      { key: "lead_time", value: "Ships in 2–3 weeks (live-edge sourcing)" },
      { key: "material", value: "Live-edge white oak, blackened steel base" },
      { key: "care", value: "Oil with wood conditioner every 6 months. Avoid standing water." },
      { key: "is_custom", value: "false" },
    ],
  },
  {
    id: "gid://shopify/Product/3",
    title: "Cove Sectional Sofa (Custom)",
    handle: "cove-sectional-sofa",
    description: "A modular sectional built to your exact dimensions and fabric choice. Choose from 40+ fabric options and configure left or right chaise.",
    priceRange: { minVariantPrice: { amount: "3400.00", currencyCode: "USD" } },
    metafields: [
      { key: "dimensions", value: "Configurable — standard 110\" × 90\" L-shape" },
      { key: "weight_capacity", value: "800 lbs (full sectional)" },
      { key: "assembly_required", value: "Yes — sections connect (15 min)" },
      { key: "lead_time", value: "8–10 weeks (custom build)" },
      { key: "material", value: "Kiln-dried hardwood frame, sinuous spring base, fabric of choice" },
      { key: "care", value: "Varies by fabric — refer to care tag on your unit" },
      { key: "is_custom", value: "true" },
    ],
  },
  {
    id: "gid://shopify/Product/4",
    title: "Slab Coffee Table",
    handle: "slab-coffee-table",
    description: "A solid concrete coffee table with a polished top and raw sides. Pairs with the Ember Lounge Chair.",
    priceRange: { minVariantPrice: { amount: "680.00", currencyCode: "USD" } },
    metafields: [
      { key: "dimensions", value: "48\" L × 24\" W × 16\" H" },
      { key: "weight_capacity", value: "N/A — surface" },
      { key: "assembly_required", value: "No" },
      { key: "lead_time", value: "Ships in 5–7 business days (freight shipping)" },
      { key: "material", value: "Reinforced concrete, sealed surface" },
      { key: "care", value: "Seal annually. Blot spills immediately — concrete is porous." },
      { key: "is_custom", value: "false" },
    ],
  },
];

export const MOCK_ORDERS: Record<string, MockOrder> = {
  "AW-10042": {
    id: "gid://shopify/Order/10042",
    orderNumber: "AW-10042",
    email: "sarah@example.com",
    financialStatus: "paid",
    fulfillmentStatus: "fulfilled",
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(), // 12 days ago
    lineItems: [
      { title: "Ember Lounge Chair", quantity: 1, price: "1290.00", isCustom: false }
    ],
    shippingAddress: { city: "Portland", province: "OR", country: "US" },
    trackingUrl: "https://tracking.example.com/AW10042",
    trackingNumber: "1Z999AA10123456784",
    carrier: "UPS",
    totalPrice: "1290.00",
    canReturn: true,
    returnWindowDays: 30,
  },
  "AW-10091": {
    id: "gid://shopify/Order/10091",
    orderNumber: "AW-10091",
    email: "james@example.com",
    financialStatus: "paid",
    fulfillmentStatus: "in_transit",
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
    lineItems: [
      { title: "Drift Dining Table", quantity: 1, price: "2850.00", isCustom: false }
    ],
    shippingAddress: { city: "Austin", province: "TX", country: "US" },
    trackingUrl: "https://tracking.example.com/AW10091",
    trackingNumber: "FX123456789",
    carrier: "FedEx Freight",
    totalPrice: "2850.00",
    canReturn: false, // not delivered yet
    returnWindowDays: 30,
  },
  "AW-9887": {
    id: "gid://shopify/Order/9887",
    orderNumber: "AW-9887",
    email: "lin@example.com",
    financialStatus: "paid",
    fulfillmentStatus: "fulfilled",
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days ago — outside window
    lineItems: [
      { title: "Slab Coffee Table", quantity: 1, price: "680.00", isCustom: false }
    ],
    shippingAddress: { city: "Chicago", province: "IL", country: "US" },
    trackingUrl: null,
    trackingNumber: null,
    carrier: null,
    totalPrice: "680.00",
    canReturn: false,
    returnWindowDays: 30,
  },
  "AW-10115": {
    id: "gid://shopify/Order/10115",
    orderNumber: "AW-10115",
    email: "maria@example.com",
    financialStatus: "paid",
    fulfillmentStatus: "fulfilled",
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), // 20 days ago
    lineItems: [
      { title: "Cove Sectional Sofa (Custom) — Sage Boucle, Left Chaise", quantity: 1, price: "4100.00", isCustom: true }
    ],
    shippingAddress: { city: "Seattle", province: "WA", country: "US" },
    trackingUrl: "https://tracking.example.com/AW10115",
    trackingNumber: "WG88712344",
    carrier: "White Glove Delivery",
    totalPrice: "4100.00",
    canReturn: false, // custom item — never returnable
    returnWindowDays: 0,
  },
};

export type MockOrder = {
  id: string;
  orderNumber: string;
  email: string;
  financialStatus: string;
  fulfillmentStatus: string;
  createdAt: string;
  lineItems: { title: string; quantity: number; price: string; isCustom: boolean }[];
  shippingAddress: { city: string; province: string; country: string };
  trackingUrl: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  totalPrice: string;
  canReturn: boolean;
  returnWindowDays: number;
};
