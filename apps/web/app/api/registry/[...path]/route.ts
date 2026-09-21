import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { loadClientEnv } from "@netram/config";
import { SESSION_COOKIE } from "../../../../lib/api";

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, context: RouteContext, method: "GET" | "POST") {
  const { path } = await context.params;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const env = loadClientEnv();
  const target = `${env.NEXT_PUBLIC_API_URL}/api/v1/registry/${path.join("/")}`;

  const res = await fetch(target, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: method === "POST" ? JSON.stringify(await request.json().catch(() => ({}))) : undefined,
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload, { status: res.status });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "GET");
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "POST");
}
