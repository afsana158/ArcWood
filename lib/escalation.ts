// lib/escalation.ts
// Two-layer escalation: hard triggers (deterministic) + soft triggers (AI-scored).
// Hard triggers run BEFORE the LLM sees the message.
// Soft triggers run AFTER the agent responds, on each turn.

import Anthropic from "@anthropic-ai/sdk";

// ─── Hard Triggers ────────────────────────────────────────────────────────────

const LEGAL_SAFETY_KEYWORDS = [
  "lawyer", "attorney", "sue", "lawsuit", "legal action",
  "injured", "hurt myself", "hurt my", "unsafe", "dangerous product",
  "bbb", "better business bureau", "file a complaint", "consumer protection",
  "small claims", "chargeback",
];

const HIGH_VALUE_DISPUTE_THRESHOLD = 800; // USD

export type HardTriggerResult =
  | { triggered: false }
  | { triggered: true; reason: string };

export function checkHardTriggers(
  userMessage: string,
  orderValueUsd?: number,
  consecutiveUnresolvedTurns?: number
): HardTriggerResult {
  const lower = userMessage.toLowerCase();

  // 1. Legal / safety language
  const matched = LEGAL_SAFETY_KEYWORDS.find((kw) => lower.includes(kw));
  if (matched) {
    return { triggered: true, reason: `Legal or safety language detected: "${matched}"` };
  }

  // 2. Customer explicitly requests a human
  const humanRequestPhrases = [
    "speak to a person", "talk to a human", "real person", "actual person",
    "speak to someone", "talk to someone", "agent please", "representative",
    "connect me to", "transfer me",
  ];
  if (humanRequestPhrases.some((p) => lower.includes(p))) {
    return { triggered: true, reason: "Customer explicitly requested a human agent" };
  }

  // 3. High-value dispute
  if (orderValueUsd && orderValueUsd > HIGH_VALUE_DISPUTE_THRESHOLD) {
    const disputeSignals = ["damaged", "broken", "wrong item", "missing", "defective", "not working", "refund", "return"];
    if (disputeSignals.some((s) => lower.includes(s))) {
      return { triggered: true, reason: `High-value order dispute (>$${HIGH_VALUE_DISPUTE_THRESHOLD})` };
    }
  }

  // 4. Repeated unresolved issue (tracked by orchestrator)
  if (consecutiveUnresolvedTurns && consecutiveUnresolvedTurns >= 3) {
    return { triggered: true, reason: "Issue unresolved after 3 consecutive turns" };
  }

  return { triggered: false };
}

// ─── Soft Triggers ────────────────────────────────────────────────────────────

export type SoftTriggerResult = {
  shouldEscalate: boolean;
  emotionalIntensity: number; // 1–5
  resolutionConfidence: number; // 0–1
  policyAmbiguity: boolean;
  complexIssue: boolean;
  reason?: string;
};

export async function scoreSoftTriggers(
  conversationHistory: Array<{ role: string; content: string }>,
  lastUserMessage: string,
  lastAgentResponse: string
): Promise<SoftTriggerResult> {
  const prompt = `You are evaluating a customer support conversation to decide if it needs human escalation.

CONVERSATION (last 4 turns max):
${conversationHistory.slice(-8).map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n")}

LAST USER MESSAGE: ${lastUserMessage}
LAST AGENT RESPONSE: ${lastAgentResponse}

Score these 4 dimensions. Respond ONLY with a JSON object, no preamble:
{
  "emotionalIntensity": <1-5, where 5 = extremely distressed, angry, or upset>,
  "resolutionConfidence": <0.0-1.0, where 1.0 = issue clearly resolved, 0.0 = agent clearly cannot resolve>,
  "policyAmbiguity": <true if the situation involves a genuine policy edge case not clearly covered>,
  "complexIssue": <true if there are multiple entangled problems the agent cannot cleanly separate>
}`;

  try {
    const raw = await simpleChat(prompt);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const scores = JSON.parse(cleaned);

    const shouldEscalate =
      scores.emotionalIntensity >= 4 ||
      scores.resolutionConfidence < 0.55 ||
      scores.policyAmbiguity ||
      scores.complexIssue;

    const reasons = [];
    if (scores.emotionalIntensity >= 4) reasons.push(`High emotional intensity (${scores.emotionalIntensity}/5)`);
    if (scores.resolutionConfidence < 0.55) reasons.push(`Low resolution confidence (${scores.resolutionConfidence})`);
    if (scores.policyAmbiguity) reasons.push("Policy ambiguity detected");
    if (scores.complexIssue) reasons.push("Complex multi-issue detected");

    return {
      shouldEscalate,
      emotionalIntensity: scores.emotionalIntensity,
      resolutionConfidence: scores.resolutionConfidence,
      policyAmbiguity: scores.policyAmbiguity,
      complexIssue: scores.complexIssue,
      reason: reasons.join("; ") || undefined,
    };
  } catch {
    // Soft scoring failure — log and do NOT escalate (system issue, not customer issue)
    console.error("[escalation] Soft trigger scoring failed — continuing without escalation");
    return {
      shouldEscalate: false,
      emotionalIntensity: 1,
      resolutionConfidence: 1,
      policyAmbiguity: false,
      complexIssue: false,
    };
  }
}

// ─── Escalation response builder ──────────────────────────────────────────────

export function buildEscalationMessage(reason: string): string {
  return (
    "I want to make sure you get the best possible help here, and I think this is a situation where one of our team members should step in directly.\n\n" +
    "I've created a support ticket with the full context of our conversation, so you won't need to repeat anything. " +
    "A member of the Arcwood team will follow up **within 2 business hours** (Mon–Fri, 9am–6pm PT).\n\n" +
    "Is there anything else I can note for the team before I hand this off?"
  );
}

export function buildEscalationTicket(
  sessionId: string,
  conversationHistory: Array<{ role: string; content: string }>,
  triggerReason: string,
  lastUserMessage: string
): Record<string, unknown> {
  // In production, write this to your CRM / helpdesk (e.g. Gorgias, Zendesk).
  // For the hackathon, we log it and return the structured data.
  const ticket = {
    ticket_id: `ESC-${Date.now()}`,
    session_id: sessionId,
    created_at: new Date().toISOString(),
    trigger_reason: triggerReason,
    last_customer_message: lastUserMessage,
    conversation_length: conversationHistory.length,
    issue_summary: deriveIssueSummary(conversationHistory),
    full_transcript: conversationHistory,
  };
  console.log("[escalation] Ticket created:", JSON.stringify(ticket, null, 2));
  return ticket;
}

function deriveIssueSummary(history: Array<{ role: string; content: string }>): string {
  // Extract first user message as the seed of the issue summary
  const firstUser = history.find((m) => m.role === "user");
  return firstUser
    ? `Customer inquiry: "${firstUser.content.slice(0, 120)}${firstUser.content.length > 120 ? "…" : ""}"`
    : "No user message found";
}
