// lib/ai.ts
// Gemini adapter. All AI calls in the app go through here.
// Switch back to Claude anytime by replacing this file.

import { GoogleGenerativeAI, type Content, type Tool } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Free-tier model — fast, generous quota
export const MODEL = "gemini-1.5-flash";

// ─── Types (internal) ─────────────────────────────────────────────────────────

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ToolCall = { name: string; args: Record<string, unknown>; callId: string };

export type ChatResult = {
  text: string;
  toolCalls: ToolCall[];
  stopped: boolean; // true = no more tool calls, done
};

// ─── Message format conversion ────────────────────────────────────────────────
// Session stores { role: "user"|"assistant", content: string }
// Gemini wants  { role: "user"|"model",      parts: [{text}] }

function toGeminiHistory(messages: ChatMessage[]): Content[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

// ─── Tool definition conversion ───────────────────────────────────────────────
// Our tools use Anthropic's input_schema format; Gemini uses parameters.
// The JSON Schema shape is identical — just a key rename.

function toGeminiTools(toolDefs: readonly { name: string; description: string; input_schema: unknown }[]): Tool[] {
  return [
    {
      functionDeclarations: toolDefs.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.input_schema as any,
      })),
    },
  ];
}

// ─── Main chat function (with tool-calling loop) ──────────────────────────────

export async function chatWithTools(
  systemPrompt: string,
  history: ChatMessage[],       // everything EXCEPT the last user message
  userMessage: string,
  toolDefs: readonly { name: string; description: string; input_schema: unknown }[],
  toolHandler: (name: string, args: Record<string, unknown>) => Promise<unknown>,
  maxRounds = 5
): Promise<{ finalText: string; totalRounds: number }> {

  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: systemPrompt,
    tools: toGeminiTools(toolDefs),
    generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
  });

  // Start chat with history (excluding the current user message)
  const chat = model.startChat({ history: toGeminiHistory(history) });

  let result = await chat.sendMessage(userMessage);
  let response = result.response;
  let rounds = 0;

  // Tool-call loop
  while (rounds < maxRounds) {
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const fnCall = parts.find((p: any) => p.functionCall);

    if (!fnCall) break; // No tool call — we have a final text response

    const { name, args } = fnCall.functionCall;
    let toolResult: unknown;

    try {
      toolResult = await toolHandler(name, args ?? {});
    } catch (err) {
      console.error(`[ai] Tool "${name}" threw:`, err);
      toolResult = { success: false, error: "tool_crashed" };
    }

    // Send the tool result back to the model
    result = await chat.sendMessage([
      {
        functionResponse: {
          name,
          response: { result: toolResult },
        },
      } as any,
    ]);
    response = result.response;
    rounds++;
  }

  const finalText = response.text().trim();
  return { finalText, totalRounds: rounds };
}

// ─── Simple one-shot call (used for soft escalation scoring) ──────────────────

export async function simpleChat(prompt: string): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: { maxOutputTokens: 256, temperature: 0.1 },
  });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
