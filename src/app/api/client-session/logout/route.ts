import { NextResponse } from "next/server";
import { clearAllSessionCookies } from "@/lib/client-portal";

/** POST /api/client-session/logout — encerra a sessão neste aparelho. */
export async function POST() {
  const out = NextResponse.json({ ok: true });
  clearAllSessionCookies(out);
  return out;
}
