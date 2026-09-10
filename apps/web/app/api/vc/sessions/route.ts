import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { loadClientEnv } from "@netram/config";
import { SESSION_COOKIE } from "../../../../lib/api";

export async function GET(request: NextRequest) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const env = loadClientEnv();
  const search = request.nextUrl.search;
  const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/vc/sessions${search}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload, { status: res.status });
}

export async function POST(request: NextRequest) {
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

  const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/vc/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload, { status: res.status });
}
