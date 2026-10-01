import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { loadClientEnv } from "@netram/config";
import { SESSION_COOKIE } from "../../../../../../lib/api";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { id, fileId } = await params;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const env = loadClientEnv();
  const res = await fetch(`${env.NETRAM_API_BASE_URL}/api/v1/complaints/${id}/files/${fileId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    return new NextResponse(res.statusText, { status: res.status });
  }

  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const contentLength = res.headers.get("content-length");
  const disposition = res.headers.get("content-disposition");
  const headers = new Headers();
  headers.set("Content-Type", contentType);
  if (contentLength) headers.set("Content-Length", contentLength);
  if (disposition) headers.set("Content-Disposition", disposition);
  headers.set("Cache-Control", "private, max-age=3600");

  return new NextResponse(res.body, {
    status: 200,
    headers,
  });
}
