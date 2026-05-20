// lib/session.ts
// In-memory session store keyed by session ID.
// KNOWN LIMITATION: lost on server restart, does not scale horizontally.
// Production path: replace with Redis + TTL.

import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

type Session = {
  history: MessageParam[];
  createdAt: number;
  lastActiveAt: number;
  escalated: boolean;
  turnCount: number;
};

const store = new Map<string, Session>();

// Evict sessions older than TTL every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of store.entries()) {
    if (now - session.lastActiveAt > SESSION_TTL_MS) store.delete(id);
  }
}, 15 * 60 * 1000);

export function getSession(id: string): Session {
  if (!store.has(id)) {
    store.set(id, {
      history: [],
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      escalated: false,
      turnCount: 0,
    });
  }
  const s = store.get(id)!;
  s.lastActiveAt = Date.now();
  return s;
}

export function updateSession(id: string, patch: Partial<Session>) {
  const s = getSession(id);
  Object.assign(s, patch);
}

export function generateSessionId(): string {
  return crypto.randomUUID();
}
