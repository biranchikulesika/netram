import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { loadClientEnv } from "@netram/config";
import { SESSION_COOKIE } from "../../../../../../lib/api";

/**
 * Same-origin proxy for viewer session lifecycle (Phase 5):
 *   DELETE → ends the NETRAM stream session (viewer_stop) and triggers the
 *            gateway's correlated MediaMTX reader kick.
 *   POST   → viewer heartbeat (keeps the session alive against the sweeper).
 *
 * Cookie→Bearer bridged server-side (browser never handles the JWT).
 */

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; streamId: string }> },
) {
  const { id, streamId } = await params;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const env = loadClientEnv();
  const res = await fetch(
    `${env.NETRAM_API_BASE_URL}/api/v1/cctv/cameras/${encodeURIComponent(id)}/streams/${encodeURIComponent(streamId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ endReason: "viewer_stop" }),
    },
  );

  const data = (await res.json().catch(() => null)) as unknown;
  return NextResponse.json(data, { status: res.status });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; streamId: string }> },
) {
  const { id, streamId } = await params;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const env = loadClientEnv();
  const res = await fetch(
    `${env.NETRAM_API_BASE_URL}/api/v1/cctv/cameras/${encodeURIComponent(id)}/streams/${encodeURIComponent(streamId)}/heartbeat`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    },
  );

  const data = (await res.json().catch(() => null)) as unknown;
  return NextResponse.json(data, { status: res.status });
}
