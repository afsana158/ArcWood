// app/api/chat/route.ts
// Agent orchestrator — now powered by Gemini via lib/ai.ts.
// The tool layer (lib/tools/) and escalation logic are unchanged.

import { NextRequest, NextResponse } from "next/server";
import { chatWithTools } from "@/lib/ai";
import { getSession, updateSession, generateSessionId } from "@/lib/session";
import { getPolicySummaryForPrompt } from "@/lib/policies";
import {
  checkHardTriggers,
  scoreSoftTriggers,
  buildEscalationMessage,
} from "@/lib/escalation";
import { TOOL_DEFINITIONS, TOOL_HANDLERS } from "@/lib/tools";

const SESSION_COOKIE = "arcwood_session";

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are Arcwood's customer support agent. Arcwood is a premium home furniture brand.

TOOLS: Always use tools — never answer from memory.
- Product questions → get_product or search_products first
- Order questions → get_order (requires order number + email, both mandatory)
- Policy questions → get_policies first
- Returns → check_return_eligibility first, then initiate_return only if eligible and customer confirms

RESPONSE FORMAT — this is critical:
When showing order details, format as key-value pairs on separate lines:
Order: [number]
Status: [status]
Item: [product name]
Carrier: [carrier name]
Tracking: [number]
[Any next step or action]

When a return is confirmed, lead with the confirmation clearly.
When something is ineligible, state why clearly and what the customer can do instead.
For product specs, list the key facts (dimensions, material, lead time, assembly) concisely.

RULES:
- Be direct. No filler phrases like "Great question!" or "Of course!"
- 3-5 sentences max for most responses. Structured data replaces paragraphs.
- If the API fails, say so honestly and offer a path forward.
- Never guess or fabricate product specs, policy details, or order info.
- If you cannot resolve something, say so clearly and escalate.

TONE: Warm but efficient. Like a knowledgeable friend, not a corporate script.

${getPolicySummaryForPrompt()}`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userMessage: string = body.message?.trim();
    if (!userMessage) return NextResponse.json({ error: "No message" }, { status: 400 });

    // ── Session ──
    let sessionId = req.cookies.get(SESSION_COOKIE)?.value;
    if (!sessionId) sessionId = generateSessionId();
    const session = getSession(sessionId);

    // ── Hard trigger check (pre-AI) ──
    const hardTrigger = checkHardTriggers(
      userMessage,
      undefined,
      session.escalated ? 999 : 0
    );

    if (hardTrigger.triggered || session.escalated) {
      updateSession(sessionId, { escalated: true });
      const res = NextResponse.json({
        reply: buildEscalationMessage(hardTrigger.triggered ? hardTrigger.reason : "Previously escalated"),
        escalated: true,
        mode: process.env.SHOPIFY_STORE_DOMAIN ? "live" : "demo",
      });
      res.cookies.set(SESSION_COOKIE, sessionId, { httpOnly: true, sameSite: "lax", maxAge: 3600 });
      return res;
    }

    // ── Build history for this turn (exclude last user message — sent separately) ──
    const history = session.history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));

    // ── Call Gemini with tool-calling loop ──
    let finalText = "";
    let totalRounds = 0;

    try {
      const result = await chatWithTools(
        buildSystemPrompt(),
        history,
        userMessage,
        TOOL_DEFINITIONS,
        async (name, args) => {
          const handler = TOOL_HANDLERS[name];
          if (!handler) return { success: false, error: "unknown_tool" };
          return await handler(args);
        },
        5 // max tool rounds
      );
      finalText = result.finalText;
      totalRounds = result.totalRounds;
    } catch (err) {
      console.error("[route] AI call failed:", err);
      // Retry with bare message (no history) before giving up
      try {
        const retry = await chatWithTools(buildSystemPrompt(), [], userMessage, TOOL_DEFINITIONS,
          async (name, args) => { const h = TOOL_HANDLERS[name]; return h ? h(args) : { success: false }; }, 2);
        finalText = retry.finalText;
      } catch {
        finalText = "I'm having a moment — let me connect you with someone who can help right away.";
        updateSession(sessionId, { escalated: true });
      }
    }

    if (!finalText || finalText.length < 3) {
      finalText = "I wasn't able to put a response together. Let me connect you with our team.";
      updateSession(sessionId, { escalated: true });
    }

    // ── Update session history ──
    session.history.push({ role: "user", content: userMessage });
    session.history.push({ role: "assistant", content: finalText });
    session.turnCount++;

    // ── Soft trigger scoring (only after turn 2+) ──
    let escalated = false;
    if (session.turnCount >= 2) {
      const historyForScoring = session.history.slice(-8).map((m) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      }));
      const softScore = await scoreSoftTriggers(historyForScoring, userMessage, finalText);
      if (softScore.shouldEscalate) {
        console.log(`[escalation] Soft trigger: ${softScore.reason}`);
        updateSession(sessionId, { escalated: true });
        escalated = true;
      }
    }

    const resData = {
      reply: finalText,
      escalated,
      mode: process.env.SHOPIFY_STORE_DOMAIN ? "live" : "demo",
      ...(process.env.NODE_ENV === "development" && { debug: { totalRounds, turnCount: session.turnCount } }),
    };

    const res = NextResponse.json(resData);
    res.cookies.set(SESSION_COOKIE, sessionId, { httpOnly: true, sameSite: "lax", maxAge: 3600 });
    return res;

  } catch (err) {
    console.error("[api/chat] Unhandled:", err);
    return NextResponse.json({ reply: "Something went wrong. Please try again.", escalated: false }, { status: 500 });
  }
}
