import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { loadClientEnv } from "@netram/config";
import { isPublicApiPath } from "@netram/types";
import { SESSION_COOKIE } from "../../../../lib/api";

async function proxy(request: NextRequest, params: { path: string[] }) {
  const pathSegments = params.path ?? [];
  if (pathSegments.some((p) => p === ".." || p === "." || p.includes("/") || p.includes("\\"))) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid path segments" } },
      { status: 400 },
    );
  }

  const subPath = pathSegments.join("/");
  // Full API path, used both to build the target URL and to decide whether the
  // call needs a session token.
  const apiPath = `/api/v1/${subPath}`;

  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  // Unauthenticated API entry points (sign-in, public tracking, registry, docs)
  // must be reachable BEFORE a session exists. Requiring the cookie here would
  // deadlock: the endpoint that mints the cookie is itself behind this check.
  // The list is the shared API contract; the API independently marks the same
  // paths public, so this is not a new authorisation surface.
  const isPublic = isPublicApiPath(apiPath);
  if (!token && !isPublic) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const env = loadClientEnv();
  const url = new URL(request.url);
  const targetUrl = `${env.NETRAM_API_BASE_URL}${apiPath}${url.search}`;

  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();

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
