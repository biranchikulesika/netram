import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { loadClientEnv } from "@netram/config";
import { SESSION_COOKIE } from "../../../../../lib/api";

/**
 * Proxies contact-detail updates to the API so the httpOnly session token
 * authorises the call (same pattern as the project transition proxy).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const body = await request.json();
  const env = loadClientEnv();

  const res = await fetch(`${env.NETRAM_API_BASE_URL}/api/v1/projects/${id}/contact`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload, { status: res.status });
}
