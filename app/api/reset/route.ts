// app/api/reset/route.ts
// Clears the session cookie so the next chat request starts fresh.
// Called by the "↺ Reset" button in the UI.

import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "arcwood_session";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  // Expire the session cookie immediately
  res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, httpOnly: true, sameSite: "lax" });
  return res;
}
