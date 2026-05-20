// lib/tools/index.ts
// All tool implementations and their JSON schema definitions for Claude's tool_use API.
// The AI decides WHICH tool to call. This code decides WHAT ACTUALLY HAPPENS.

import { MOCK_PRODUCTS, MOCK_ORDERS, USE_MOCK, shopifyQuery } from "@/lib/shopify";
import { ARCWOOD_POLICIES } from "@/lib/policies";
import { buildEscalationTicket } from "@/lib/escalation";

// ─── Types ────────────────────────────────────────────────────────────────────

type ToolResult = { success: true; data: unknown } | { success: false; error: string; userMessage: string };

// ─── Tool: get_product ────────────────────────────────────────────────────────

export async function get_product({ product_id }: { product_id: string }): Promise<ToolResult> {
  try {
    if (USE_MOCK) {
      const product = MOCK_PRODUCTS.find((p) => p.id === product_id || p.handle === product_id);
      if (!product) return { success: false, error: "not_found", userMessage: "I couldn't find that product in our catalog." };
      return { success: true, data: product };
    }

    const data = await shopifyQuery<{ product: unknown }>(`
      query GetProduct($id: ID!) {
        product(id: $id) {
          id title handle description
          priceRange { minVariantPrice { amount currencyCode } }
          metafields(first: 20, namespace: "custom") { edges { node { key value } } }
        }
      }`, { id: product_id });

    return { success: true, data: (data as any).product };
  } catch {
    return { success: false, error: "shopify_unavailable", userMessage: "I'm having trouble fetching product details right now. You can browse our full catalog at arcwood.com." };
  }
}

// ─── Tool: search_products ────────────────────────────────────────────────────

export async function search_products({ query }: { query: string }): Promise<ToolResult> {
  try {
    if (USE_MOCK) {
      const lower = query.toLowerCase();
      const results = MOCK_PRODUCTS.filter(
        (p) =>
          p.title.toLowerCase().includes(lower) ||
          p.description.toLowerCase().includes(lower) ||
          p.metafields.some((m) => m.value.toLowerCase().includes(lower))
      );
      return { success: true, data: { products: results.slice(0, 5), total: results.length } };
    }

    const data = await shopifyQuery<{ products: unknown }>(`
      query SearchProducts($query: String!) {
        products(first: 5, query: $query) {
          edges { node {
            id title handle description
            priceRange { minVariantPrice { amount currencyCode } }
            metafields(first: 10, namespace: "custom") { edges { node { key value } } }
          }}
        }
      }`, { query });

    return { success: true, data: (data as any).products };
  } catch {
    return { success: false, error: "shopify_unavailable", userMessage: "I'm having trouble searching our catalog right now. You can browse at arcwood.com." };
  }
}

// ─── Tool: get_order ─────────────────────────────────────────────────────────

/** Normalize order numbers: "1001" → "#1001", "AW-10042" stays as-is (mock) */
function normalizeOrderNumber(raw: string): string {
  const trimmed = raw.trim().replace(/\s/g, "");
  // If it's purely numeric or starts with # followed by digits → Shopify format
  if (/^\d+$/.test(trimmed)) return `#${trimmed}`;
  if (/^#\d+$/.test(trimmed)) return trimmed;
  return trimmed.toUpperCase(); // mock format (AW-xxxxx)
}

export async function get_order({
  order_number,
  email,
}: {
  order_number: string;
  email: string;
}): Promise<ToolResult> {
  try {
    const normalized = normalizeOrderNumber(order_number);

    if (USE_MOCK) {
      const order = MOCK_ORDERS[normalized];
      if (!order) {
        return { success: false, error: "not_found", userMessage: `I couldn't find order ${order_number}. Please double-check the order number — in demo mode, try AW-10042, AW-10091, AW-9887, or AW-10115.` };
      }
      if (order.email.toLowerCase() !== email.toLowerCase()) {
        return { success: false, error: "email_mismatch", userMessage: "The email address doesn't match what we have on file for that order. Please check both and try again." };
      }
      return { success: true, data: order };
    }

    // Real Shopify: query by order name + email
    const data = await shopifyQuery<{ orders: unknown }>(`
      query GetOrder($query: String!) {
        orders(first: 1, query: $query) {
          edges { node {
            id name email financialStatus fulfillmentStatus createdAt
            totalPriceSet { shopMoney { amount currencyCode } }
            lineItems(first: 10) {
              edges { node {
                title quantity
                originalUnitPriceSet { shopMoney { amount } }
                product { metafields(first: 5, namespace: "custom") { edges { node { key value } } } }
              }}
            }
            shippingAddress { city province country }
            fulfillments(first: 1) {
              status
              trackingInfo { url number company }
              createdAt
            }
          }}
        }
      }`, { query: `name:${normalized} email:${email}` });

    const edges = (data as any).orders?.edges ?? [];
    if (!edges.length) {
      return { success: false, error: "not_found", userMessage: `I couldn't find order ${order_number} with that email address. Please double-check both — the order number should look like #1001.` };
    }

    const node = edges[0].node;

    // Normalize to a shape consistent with mock data for downstream tools
    const fulfillment = node.fulfillments?.[0];
    const trackingInfo = fulfillment?.trackingInfo?.[0];
    const lineItems = (node.lineItems?.edges ?? []).map((e: any) => ({
      title: e.node.title,
      quantity: e.node.quantity,
      price: e.node.originalUnitPriceSet?.shopMoney?.amount ?? "0",
      isCustom: (e.node.product?.metafields?.edges ?? [])
        .some((mf: any) => mf.node.key === "is_custom" && mf.node.value === "true"),
    }));

    return {
      success: true,
      data: {
        id: node.id,
        orderNumber: node.name,
        email: node.email,
        financialStatus: node.financialStatus?.toLowerCase() ?? "unknown",
        fulfillmentStatus: fulfillment
          ? fulfillment.status?.toLowerCase() ?? "in_transit"
          : "unfulfilled",
        createdAt: node.createdAt,
        lineItems,
        shippingAddress: node.shippingAddress ?? {},
        trackingUrl: trackingInfo?.url ?? null,
        trackingNumber: trackingInfo?.number ?? null,
        carrier: trackingInfo?.company ?? null,
        totalPrice: node.totalPriceSet?.shopMoney?.amount ?? "0",
      },
    };
  } catch {
    return { success: false, error: "shopify_unavailable", userMessage: "I'm having trouble accessing order information right now. Please try again in a moment, or contact our team directly." };
  }
}

// ─── Tool: get_policies ───────────────────────────────────────────────────────

export async function get_policies({ topic }: { topic: string }): Promise<ToolResult> {
  // Always local — no Shopify dependency
  const topicMap: Record<string, unknown> = {
    returns: ARCWOOD_POLICIES.returns,
    shipping: ARCWOOD_POLICIES.shipping,
    warranty: ARCWOOD_POLICIES.warranty,
    damage: ARCWOOD_POLICIES.damage_claims,
    all: ARCWOOD_POLICIES,
  };
  const key = Object.keys(topicMap).find((k) => topic.toLowerCase().includes(k)) ?? "all";
  return { success: true, data: topicMap[key] };
}

// ─── Tool: check_return_eligibility ──────────────────────────────────────────

export async function check_return_eligibility({
  order_number,
  email,
}: {
  order_number: string;
  email: string;
}): Promise<ToolResult> {
  const orderResult = await get_order({ order_number, email });
  if (!orderResult.success) return orderResult;

  const order = orderResult.data as any;

  // Check 1: custom item (never returnable)
  const hasCustomItem = USE_MOCK
    ? order.lineItems.some((li: any) => li.isCustom)
    : order.lineItems?.edges?.some((e: any) => e.node.title?.toLowerCase().includes("custom"));

  if (hasCustomItem) {
    return {
      success: true,
      data: {
        eligible: false,
        reason: "custom_item",
        explanation: "This order contains a custom or built-to-order item. Custom items are not eligible for return — this is noted at checkout and in your order confirmation.",
        requiresHumanReview: true, // Always escalate custom disputes
      },
    };
  }

  // Check 2: order must be delivered
  const isDelivered = order.fulfillmentStatus === "fulfilled";
  if (!isDelivered) {
    return {
      success: true,
      data: {
        eligible: false,
        reason: "not_delivered",
        explanation: "Your order hasn't been delivered yet — returns can only be initiated after delivery.",
      },
    };
  }

  // Check 3: 30-day window
  const deliveredAt = new Date(order.createdAt); // approximation; production would use fulfillment date
  const daysSince = Math.floor((Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24));
  const withinWindow = daysSince <= 30;

  return {
    success: true,
    data: {
      eligible: withinWindow,
      days_since_delivery: daysSince,
      window_days: 30,
      reason: withinWindow ? "eligible" : "outside_window",
      explanation: withinWindow
        ? `Your order is within the 30-day return window (${daysSince} days since delivery). You can return this item.`
        : `Your order was delivered ${daysSince} days ago — this is outside our 30-day return window.`,
    },
  };
}

// ─── Tool: initiate_return ────────────────────────────────────────────────────

export async function initiate_return({
  order_number,
  email,
  reason,
}: {
  order_number: string;
  email: string;
  reason: string;
}): Promise<ToolResult> {
  // First, re-verify eligibility deterministically — Claude cannot bypass this
  const eligibilityResult = await check_return_eligibility({ order_number, email });
  if (!eligibilityResult.success) return eligibilityResult;

  const eligibility = eligibilityResult.data as any;
  if (!eligibility.eligible) {
    return {
      success: false,
      error: "not_eligible",
      userMessage: eligibility.explanation,
    };
  }

  try {
    if (USE_MOCK) {
      // Simulate return creation
      const returnId = `RET-${Date.now()}`;
      console.log(`[return] Initiated return ${returnId} for order ${order_number}: ${reason}`);
      return {
        success: true,
        data: {
          return_id: returnId,
          order_number,
          status: "created",
          next_steps: "A prepaid return label will be emailed to you within 1 business hour. Package the item securely and drop off at any UPS location.",
          refund_timeline: "Refunds are processed within 3–5 business days of receiving the item.",
        },
      };
    }

    // Real Shopify: use Returns API (Admin GraphQL)
    const data = await shopifyQuery<unknown>(`
      mutation ReturnCreate($input: ReturnInput!) {
        returnCreate(input: $input) {
          return { id status }
          userErrors { field message }
        }
      }`, {
      input: {
        orderId: order_number, // In production, use the GID from get_order
        returnLineItems: [], // Would be populated from order line items
        notifyCustomer: true,
      },
    });

    return { success: true, data };
  } catch {
    return { success: false, error: "return_creation_failed", userMessage: "I wasn't able to create your return automatically right now. I'll escalate this to our team who will process it manually — you'll hear from us within 2 business hours." };
  }
}

// ─── Tool: create_escalation_ticket ──────────────────────────────────────────

export async function create_escalation_ticket({
  session_id,
  reason,
  conversation_history,
  last_user_message,
}: {
  session_id: string;
  reason: string;
  conversation_history: Array<{ role: string; content: string }>;
  last_user_message: string;
}): Promise<ToolResult> {
  const ticket = buildEscalationTicket(session_id, conversation_history, reason, last_user_message);
  // In production: POST to Gorgias/Zendesk/your CRM here
  return { success: true, data: ticket };
}

// ─── Tool registry ────────────────────────────────────────────────────────────

export const TOOL_HANDLERS: Record<string, (args: any) => Promise<ToolResult>> = {
  get_product,
  search_products,
  get_order,
  get_policies,
  check_return_eligibility,
  initiate_return,
  create_escalation_ticket,
};

// ─── Tool schemas (passed to Claude) ─────────────────────────────────────────

export const TOOL_DEFINITIONS = [
  {
    name: "get_product",
    description: "Fetch detailed product information from the Arcwood catalog by product ID or handle. Use when a customer asks about a specific product's specs, dimensions, materials, lead time, care instructions, or price.",
    input_schema: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "The Shopify product GID or URL handle (e.g. 'ember-lounge-chair')" },
      },
      required: ["product_id"],
    },
  },
  {
    name: "search_products",
    description: "Search the Arcwood product catalog by keyword. Use for open-ended product questions ('do you have any concrete furniture?') or when the customer hasn't named a specific product.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural language search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_order",
    description: "Look up a customer's order by order number and email. ALWAYS require both — never look up an order with just a name or order number alone.",
    input_schema: {
      type: "object",
      properties: {
        order_number: { type: "string", description: "Order number (e.g. AW-10042)" },
        email: { type: "string", description: "Email address used at checkout" },
      },
      required: ["order_number", "email"],
    },
  },
  {
    name: "get_policies",
    description: "Retrieve Arcwood's official store policies. Use before answering any question about returns, shipping, warranty, or damage claims to ensure accuracy.",
    input_schema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Policy topic: 'returns', 'shipping', 'warranty', 'damage', or 'all'" },
      },
      required: ["topic"],
    },
  },
  {
    name: "check_return_eligibility",
    description: "Check whether a specific order is eligible for return. Run this BEFORE offering or initiating a return. It handles custom item detection and the 30-day window check.",
    input_schema: {
      type: "object",
      properties: {
        order_number: { type: "string" },
        email: { type: "string" },
      },
      required: ["order_number", "email"],
    },
  },
  {
    name: "initiate_return",
    description: "Create a return for an eligible order in Shopify. Only call this AFTER the customer has confirmed they want to proceed with the return AND check_return_eligibility returned eligible: true.",
    input_schema: {
      type: "object",
      properties: {
        order_number: { type: "string" },
        email: { type: "string" },
        reason: { type: "string", description: "Customer's stated reason for the return" },
      },
      required: ["order_number", "email", "reason"],
    },
  },
  {
    name: "create_escalation_ticket",
    description: "Create a human support escalation ticket. Use when the situation requires human judgment. Include full context so the agent starts informed.",
    input_schema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        reason: { type: "string", description: "Why escalation is needed" },
        conversation_history: {
          type: "array",
          items: { type: "object", properties: { role: { type: "string" }, content: { type: "string" } }, required: ["role", "content"] },
        },
        last_user_message: { type: "string" },
      },
      required: ["session_id", "reason", "conversation_history", "last_user_message"],
    },
  },
] as const;
