import { NextResponse } from "next/server";
import { loadClientEnv } from "@netram/config";

export async function GET() {
  const env = loadClientEnv();
  const res = await fetch(`${env.NETRAM_API_BASE_URL}/api/v1/projects/registry`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const payload = await res.json().catch(() => null);
  return NextResponse.json(payload, { status: res.status });
}