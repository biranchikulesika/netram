import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { loadClientEnv } from "@netram/config";

/**
 * DEVELOPMENT-ONLY same-origin WHEP proxy (CCTV Phase 2 - throwaway rig).
 *
 * Proves the media pipeline: RTSP -> MediaMTX -> WebRTC/WHEP -> browser.
 * This route is NOT part of the CCTV API contract and must not be consumed
 * by any production feature (that is Phase 3+ gateway/API work).
 *
 * Why a proxy: MediaMTX WHEP is plain HTTP on a non-443 port with a
 * non-web origin. Proxying keeps the browser same-origin (no CORS
 * configuration on the media server) and keeps the MediaMTX host internal
 * to the server side. In production this becomes the media reverse proxy
 * on HTTPS 443 (target architecture §11).
 *
 * PHASE 4: when the caller supplies `?token=`, the proxy forwards it to
 * MediaMTX as `Authorization: Bearer <token>` - the external auth hook
 * (NETRAM API /media/auth) validates it against the live session record.
 * Without a token, the proxy falls back to the internal Basic credential
 * (dev-open media plane, documented in cctv-phase-1-2/3/4.md). Production
 * playback MUST always use the token path.
 *
 * Gated to non-production: returns 404 when NODE_ENV=production.
 */

const PATH_PATTERN = /^[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*$/;

export const runtime = "nodejs";

function mediaUnavailable(detail: string): NextResponse {
  return new NextResponse(`Media server unavailable: ${detail}`, { status: 502 });
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const pathName = request.nextUrl.searchParams.get("path") ?? "";
  if (!PATH_PATTERN.test(pathName)) {
    return new NextResponse("Invalid or missing 'path' query parameter", { status: 400 });
  }

  const token = request.nextUrl.searchParams.get("token") ?? "";
  // Phase 5 session correlation: MediaMTX echoes the WHEP request's query
  // string into its WebRTC session record (`query` field, live-verified on
  // v1.21.1). Forwarding `netramSession` upstream lets the control plane
  // match a MediaMTX reader UUID to a NETRAM cctv_streams session.
  const netramSession = request.nextUrl.searchParams.get("netramSession") ?? "";

  const offer = await request.text();
  if (offer.length === 0 || !offer.includes("v=0")) {
    return new NextResponse("Body must be an SDP offer", { status: 400 });
  }

  const env = loadClientEnv();
  const base = env.NETRAM_MEDIAMTX_WHEP_URL.replace(/\/+$/, "");

  // Credential resolution (server-side only - the browser never sees either
  // credential form): a NETRAM playback token takes precedence and is handed
  // to the MediaMTX external auth hook; otherwise the dev-rig internal
  // Basic credential applies (Phase 1-4 dev-open media plane).
  const upstreamHeaders: Record<string, string> = {
    "Content-Type": "application/sdp",
  };
  if (token.length > 0) {
    upstreamHeaders.Authorization = `Bearer ${token}`;
  } else {
    upstreamHeaders.Authorization = `Basic ${Buffer.from(
      `${env.NETRAM_MEDIAMTX_WHEP_USERNAME}:${env.NETRAM_MEDIAMTX_WHEP_PASSWORD}`,
    ).toString("base64")}`;
  }

  let upstream: Response;
  const upstreamQuery = new URLSearchParams();
  if (token) upstreamQuery.set("token", token);
  if (netramSession) upstreamQuery.set("netramSession", netramSession);
  const upstreamSuffix = upstreamQuery.size > 0 ? `?${upstreamQuery.toString()}` : "";
  try {
    upstream = await fetch(`${base}/${pathName}/whep${upstreamSuffix}`, {
      method: "POST",
      headers: upstreamHeaders,
      body: offer,
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return mediaUnavailable(
      "WHEP endpoint unreachable. Is the media rig running? " +
        "Start it with: docker compose --profile facility up -d",
    );
  }

  if (!upstream.ok || upstream.body === null) {
    return new NextResponse(`WHEP handshake failed upstream (status ${upstream.status})`, {
      status: upstream.status === 404 ? 404 : 502,
    });
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("Content-Type") ?? "application/sdp");
  // Rewrite the WHEP session Location to this same-origin proxy so any
  // subsequent session HTTP (PATCH/DELETE) also stays same-origin.
  const location = upstream.headers.get("Location");
  if (location) {
    const suffix = location.split("/whep/")[1] ?? "";
    headers.set(
      "X-Whep-Session-Path",
      `/api/dev/cctv/whep/${encodeURIComponent(suffix)}?path=${encodeURIComponent(pathName)}${token ? `&token=${encodeURIComponent(token)}` : ""}`,
    );
  }

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
