import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { loadClientEnv } from "@netram/config";
import { SESSION_COOKIE } from "../../../lib/api";

export async function GET(request: NextRequest) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") ?? "1";
  const pageSize = searchParams.get("pageSize") ?? "50";

  const env = loadClientEnv();
  const res = await fetch(
    `${env.NEXT_PUBLIC_API_URL}/api/v1/notifications?page=${encodeURIComponent(page)}&pageSize=${encodeURIComponent(pageSize)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload, { status: res.status });
}
