import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { loadClientEnv } from "@netram/config";
import { SESSION_COOKIE } from "../../../../../lib/api";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const env = loadClientEnv();

  const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/role-assignments/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload, { status: res.status });
}
