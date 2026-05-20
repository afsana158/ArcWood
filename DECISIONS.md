# Decision Log — Arcwood Support Agent

A running log of decisions made during the build, in "We considered X, chose Y, because Z" format.

---

## Architecture

**Tool dispatch via Gemini's native tool_use API (not prompt-engineered JSON)**
We considered having Gemini output structured JSON like `{ "action": "get_order", "args": {...} }` and parsing it manually. We chose native tool_use because it produces a reliable, typed interface between reasoning and execution. Parsing LLM-emitted JSON is fragile — it breaks on markdown fences, partial completions, and model drift.

**Three-layer separation: UI → Orchestrator → Tools**
We considered putting Shopify calls directly in the API route. We separated them into a tool layer so that: (a) the AI component is isolated from external I/O, (b) each tool can be tested independently, (c) eligibility checks run in deterministic code before any writes happen.

**Session state in a server-side Map (not client-side)**
We considered storing conversation history in localStorage. We chose server-side because: (a) it cannot be tampered with by the client, (b) the LLM never sees injected history. KNOWN GAP: this is lost on restart. Production path → Redis with TTL.

---

## Escalation

**Hard triggers run before the LLM sees the message**
We considered letting Gemini decide whether to escalate based on its judgment alone. We rejected this: safety-relevant inputs (injury, legal language) must be handled deterministically. Keyword matching is not sophisticated but it is guaranteed. The LLM is better at nuance but can be prompted or confused.

**Soft triggers run as a second LLM call, not inline reasoning**
We considered asking Gemini to self-assess escalation need as part of its response. We chose a separate scoring call because: (a) the scoring is a different task than responding, (b) we can set it to fail safely without affecting the customer's reply, (c) it's easier to tune the scoring prompt independently.

**Soft trigger fires on the CURRENT turn but escalation activates on the NEXT turn**
We considered escalating mid-turn (replacing the current reply with an escalation message). We chose to delay one turn because jarring mid-sentence escalation is a worse UX. The current reply still helps the customer. The next turn opens with the escalation message.

---

## Tools

**Order lookup requires order number + email (not name alone)**
We considered allowing name-only lookup for lower friction. Privacy and fraud prevention won. A bad match (common names, typos) is worse than higher lookup friction. Customers who fail both are immediately routed to a human — this is a feature, not a failure.

**initiate_return validates eligibility in code, not in Gemini's reasoning**
Gemini can suggest a return. It cannot bypass eligibility checks. The tool re-runs eligibility deterministically before touching Shopify. This means a prompt injection or unusual customer message cannot trick the agent into creating an invalid return.

**Custom order disputes always escalate, even if the tool says "ineligible"**
We could have let the agent just say "sorry, custom items are not returnable" and end there. We chose to escalate instead because: (a) the customer may have a legitimate grievance (damaged custom item, wrong specs), (b) a human should make this call, (c) the financial stakes are high.

---

## Product scope

**English-only**
We considered detecting language and attempting multi-language support. We scoped it out. A bad translation in a return scenario is worse than an honest "I currently support English only." Documented as a clear production gap.

**No persistent merchant configuration UI**
Policies live in a JSON file. In production, merchants need a UI to update return windows, policy text, etc. without a code deployment. Scoped out for the hackathon but the architecture (policy loaded dynamically into prompt) makes this straightforward to add.

**Mock data fallback for demo**
We built a mock data layer (MOCK_PRODUCTS, MOCK_ORDERS in shopify.ts) so the agent works without Shopify credentials. This is explicitly flagged in the UI. Judges can run the full demo without a live store.

---

## What we would do differently

- The soft escalation scoring adds ~800ms latency. We would replace it with a fine-tuned lightweight classifier in production.
- The session Map is a known scaling gap. We would migrate to Redis on day one of production.
- We would add webhook integration (order status changes → proactive chat updates) as the highest-value next feature.
