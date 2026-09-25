import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { loadClientEnv } from "@netram/config";

/**
 * PRODUCTION same-origin WHEP proxy (Phase 5) — the browser-facing media
 * route of the target architecture (§11/§12):
 *
 *   Browser ──HTTPS same-origin──▶ /api/cctv/media/whep ──server-side──▶ MediaMTX WHEP
 *
 * Distinct from the dev rig proxy (/api/dev/cctv/whep): this route requires a
 * NETRAM playback token (Authorization: Bearer, minted by the CCTV API) and
 * never falls back to the internal Basic credential — fail-closed, matching
 * the Phase 4 external auth hook model. The MediaMTX host stays server-side.
 *
 * `netramSession` (the cctv_streams session id) is forwarded in the upstream
 * query; MediaMTX echoes it into its WebRTC session record (`query` field,
 * v1.21.1) so the control plane can correlate and kick readers.
 */

const PATH_PATTERN = /^[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*$/;

export const runtime = "nodejs";

function mediaUnavailable(detail: string): NextResponse {
  return new NextResponse(`Media server unavailable: ${detail}`, { status: 502 });
}

export async function POST(request: NextRequest) {
  const pathName = request.nextUrl.searchParams.get("path") ?? "";
  if (!PATH_PATTERN.test(pathName)) {
    return new NextResponse("Invalid or missing 'path' query parameter", { status: 400 });
  }

  // The NETRAM playback token is mandatory here — no dev fallback.
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token.length === 0) {
    return new NextResponse("Missing playback token", { status: 401 });
  }

  const netramSession = request.nextUrl.searchParams.get("netramSession") ?? "";

  const offer = await request.text();
  if (offer.length === 0 || !offer.includes("v=0")) {
    return new NextResponse("Body must be an SDP offer", { status: 400 });
  }

  const env = loadClientEnv();
  const base = env.NETRAM_MEDIAMTX_WHEP_URL.replace(/\/+$/, "");

  const upstreamQuery = new URLSearchParams({ token });
  if (netramSession) upstreamQuery.set("netramSession", netramSession);

  let upstream: Response;
  try {
    upstream = await fetch(`${base}/${pathName}/whep?${upstreamQuery.toString()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/sdp",
        Authorization: `Bearer ${token}`,
      },
      body: offer,
      // The first WHEP handshake may trigger the on-demand RTSP pull, which
      // can legitimately take up to sourceOnDemandStartTimeout (10s) plus
      // network margin — do not abort before the media server can answer.
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    return mediaUnavailable(
      "WHEP endpoint unreachable. Is the media rig running? Start it with: docker compose --profile facility up -d",
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
      `/api/cctv/media/whep/${encodeURIComponent(suffix)}?path=${encodeURIComponent(pathName)}`,
    );
  }

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
