import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "../../../lib/api";

/** Storing the auth token as an httpOnly cookie after a successful dev login. */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as { token?: string };
  if (!body.token) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "token required" } },
      { status: 400 },
    );
  }
  const store = await cookies();
  store.set(SESSION_COOKIE, body.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
