import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { loadClientEnv } from "@netram/config";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const env = loadClientEnv();

  const res = await fetch(
    `${env.NEXT_PUBLIC_API_URL}/api/v1/complaints/track/${encodeURIComponent(code)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload, { status: res.status });
}
