import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { loadClientEnv } from "@netram/config";
import { SESSION_COOKIE } from "../../../../lib/api";

export async function GET() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const env = loadClientEnv();
  return NextResponse.json({ token, wsUrl: env.NEXT_PUBLIC_REALTIME_WS_URL });
}
