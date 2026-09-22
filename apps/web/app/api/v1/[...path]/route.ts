import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { loadClientEnv } from "@netram/config";
import { SESSION_COOKIE } from "../../../../lib/api";

async function proxy(request: NextRequest, params: { path: string[] }) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const pathSegments = params.path ?? [];
  if (pathSegments.some((p) => p === ".." || p === "." || p.includes("/") || p.includes("\\"))) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid path segments" } },
      { status: 400 },
    );
  }

  const env = loadClientEnv();
  const subPath = pathSegments.join("/");
  const url = new URL(request.url);
  const targetUrl = `${env.NEXT_PUBLIC_API_URL}/api/v1/${subPath}${url.search}`;

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  const body = ["GET", "HEAD"].includes(request.method)
    ? undefined
    : await request.arrayBuffer();

  const res = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
  });

  const responseHeaders = new Headers();
  const resContentType = res.headers.get("content-type");
  if (resContentType) {
    responseHeaders.set("content-type", resContentType);
  }
  const resContentDisposition = res.headers.get("content-disposition");
  if (resContentDisposition) {
    responseHeaders.set("content-disposition", resContentDisposition);
  }
  const nosniff = res.headers.get("x-content-type-options");
  if (nosniff) {
    responseHeaders.set("x-content-type-options", nosniff);
  }

  const resBody = await res.arrayBuffer();
  return new NextResponse(resBody, {
    status: res.status,
    headers: responseHeaders,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, await params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, await params);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, await params);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, await params);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, await params);
}
