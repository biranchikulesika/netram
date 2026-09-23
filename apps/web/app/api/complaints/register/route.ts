import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { loadClientEnv } from "@netram/config";

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({}, { status: 400 });

  const env = loadClientEnv();
  const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/complaints/register`, {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
    body: formData,
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload, { status: res.status });
}