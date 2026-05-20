// lib/policies.ts
// Store policies. In production, load these from a DB / merchant admin UI.
// Keeping them here makes it trivial to update without touching agent logic.

export const ARCWOOD_POLICIES = {
  returns: {
    standard_window_days: 30,
    custom_items_returnable: false,
    condition_requirement: "Item must be in original condition — unassembled or reassembled with all hardware. Installed items (e.g. wall mounts) are not eligible.",
    how_to_initiate: "Customer service initiates a return label via the support portal. We cover return shipping on defective items. Customer pays return shipping on change-of-mind returns.",
    refund_timeline: "Refunds are processed within 3–5 business days of receiving the returned item.",
    non_returnable_items: [
      "Custom or built-to-order items (any product with custom dimensions, custom fabric, or personalized configuration)",
      "Items damaged due to misuse or improper assembly",
      "Items outside the 30-day return window",
    ],
  },
  shipping: {
    standard: "Ships within 3–5 business days. Delivery in 5–10 business days depending on destination.",
    freight: "Large items (dining tables, sectionals) ship via freight or white-glove delivery. Delivery appointments are scheduled after shipment — allow 7–14 business days.",
    custom_build: "Custom/built-to-order items ship 8–10 weeks from order date.",
    international: "US domestic only at this time.",
    tracking: "Tracking information is emailed when the order ships. Freight orders are tracked via carrier reference number.",
  },
  warranty: {
    structural: "5-year limited warranty on structural components (frames, bases) against manufacturing defects.",
    upholstery: "1-year warranty on fabric and leather against manufacturing defects. Normal wear is not covered.",
    exclusions: "Damage from misuse, improper assembly, or environmental factors (humidity, direct sunlight) is not covered.",
    claim_process: "Email support with order number and photos of the defect. We assess within 2 business days.",
  },
  damage_claims: {
    process: "Report shipping damage within 7 days of delivery with photos. We will arrange a replacement or repair at no charge.",
    freight_inspection: "For freight deliveries, inspect before signing. Note any visible damage on the delivery receipt. This strengthens your claim.",
  },
  escalation_sla: {
    human_response_time: "2 business hours during business hours (Mon–Fri, 9am–6pm PT)",
    after_hours: "We will respond by 10am PT the next business day.",
  },
};

export type ArcwoodPolicies = typeof ARCWOOD_POLICIES;

export function getPolicySummaryForPrompt(): string {
  return `
ARCWOOD STORE POLICIES (use these as the authoritative source — do not invent policy details):

RETURNS:
- Standard items: 30-day return window from delivery date
- Custom/built-to-order items: NOT returnable under any circumstances
- Condition requirement: ${ARCWOOD_POLICIES.returns.condition_requirement}
- Refund timeline: ${ARCWOOD_POLICIES.returns.refund_timeline}
- Non-returnable: ${ARCWOOD_POLICIES.returns.non_returnable_items.join("; ")}

SHIPPING:
- Standard: ${ARCWOOD_POLICIES.shipping.standard}
- Freight (large items): ${ARCWOOD_POLICIES.shipping.freight}
- Custom build: ${ARCWOOD_POLICIES.shipping.custom_build}

WARRANTY:
- Structural: ${ARCWOOD_POLICIES.warranty.structural}
- Upholstery: ${ARCWOOD_POLICIES.warranty.upholstery}
- Claims: ${ARCWOOD_POLICIES.warranty.claim_process}

DAMAGE CLAIMS:
- ${ARCWOOD_POLICIES.damage_claims.process}
- ${ARCWOOD_POLICIES.damage_claims.freight_inspection}

ESCALATION:
- Human response SLA: ${ARCWOOD_POLICIES.escalation_sla.human_response_time}
`.trim();
}
