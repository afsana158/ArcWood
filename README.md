# Arcwood Support Agent

**Track 4: AI Customer Support Agent for Commerce**
Kasparro Hackathon Submission

A store-native AI support agent for Arcwood, a premium home furniture brand on Shopify. Handles pre-purchase questions, order tracking, returns, and policy inquiries — with a two-layer escalation system that knows when to hand off gracefully to a human.

---

## Quick start

```bash
npm install
cp .env.example .env.local
# Fill in GEMINI_API_KEY (required)
# Fill in SHOPIFY_* for live data (optional — mock data works without them)

npm run dev
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |
| `SHOPIFY_STORE_DOMAIN` | No | e.g. `your-store.myshopify.com` |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | No | From your custom app in Shopify Partner Dashboard |

Without the Shopify variables, the agent runs on built-in mock data (4 products, 4 orders). This is the recommended way to demo it.

## Demo scenarios (mock data)

Use the sidebar in the UI, or send these messages manually:

| Scenario | Message |
|---|---|
| Order tracking (in transit) | `Check my order AW-10091, james@example.com` |
| Return eligible | `I want to return my chair. Order AW-10042, sarah@example.com` |
| Custom item (cannot return) | `Return my sofa. Order AW-10115, maria@example.com` |
| Return window expired | `Can I return order AW-9887, lin@example.com` |
| Product question | `What are the dimensions of the Drift Dining Table?` |
| Hard escalation trigger | `I'm considering contacting a lawyer about my order` |

## Project structure

```
app/
  chat/page.tsx          # Chat UI
  api/chat/route.ts      # Agent orchestrator ← the core
  layout.tsx
  globals.css

lib/
  shopify.ts             # Shopify GraphQL client + mock data
  policies.ts            # Store policies (returns, shipping, warranty)
  session.ts             # In-memory session management
  escalation.ts          # Hard triggers + soft trigger scoring
  tools/index.ts         # All 7 tool implementations + Claude schemas

DECISIONS.md             # Decision log (required by hackathon)
```

## How the escalation system works

**Layer 1 — Hard triggers (deterministic, runs before LLM):**
- Legal/safety language: "lawyer", "injured", "sue", etc.
- Explicit human request
- High-value order disputes (>$800)
- 3+ consecutive unresolved turns

**Layer 2 — Soft triggers (AI-scored after each response):**
- Emotional intensity ≥ 4/5
- Resolution confidence < 0.55
- Policy ambiguity detected
- Complex multi-issue detected

When either fires, the agent hands off with a structured escalation ticket and a specific response window (2 business hours).

## Architecture note

The AI (Claude) decides what to say and which tools to call. Deterministic TypeScript code handles all external API calls, all eligibility checks, and all writes to Shopify. Claude cannot bypass the return eligibility check by reasoning around it — the tool re-validates independently before any action is taken.
# ArcWood