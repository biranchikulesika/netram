import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { loadClientEnv } from "@netram/config";
import { SESSION_COOKIE } from "../../../../../../lib/api";
import { rewritePlaylist } from "../../../../../../lib/hls-playlist";

/**
 * PRODUCTION same-origin HLS proxy (Phase 5 wall mode).
 *
 *   Browser ──same-origin──▶ /api/cctv/media/hls/<mediaPath>/<file>
 *                                ──server-side──▶ MediaMTX HLS (:8888)
 *
 * Authorization model is identical to WHEP (PART 13): every playlist and
 * segment request carries the NETRAM playback token (minted per session by
 * the CCTV API) and MediaMTX's external auth hook validates it against the
 * live session record. The proxy is a transport bridge only — it never
 * bypasses the hook, and the MediaMTX host stays server-side.
 *
 * Live-verified v1.21.1 playlist shape (docs/history/cctv-phase-5.md):
 *   index.m3u8 → variant URIs "video1_stream.m3u8?session=<id>&token=<tok>"
 *   variant    → "#EXT-X-MAP:URI=…_init.mp4?session=…&token=…" + segments
 *   gap filler → "gap.mp4" (no query) during on-demand source startup
 * The token MediaMTX echoed into playlist URIs is REPLACED with the
 * request's own token, so playlist URLs never outlive the viewer's session.
 */

/** One relative path segment of a media path or HLS file name. */
const SEGMENT_PATTERN = /^[a-zA-Z0-9_.-]+$/;

export const runtime = "nodejs";

function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
    { status: 401 },
  );
}

function badRequest(message: string): NextResponse {
  return new NextResponse(message, { status: 400 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const store = await cookies();
  const jwt = store.get(SESSION_COOKIE)?.value;
  if (!jwt) return unauthorized();

  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (token.length === 0) {
    return badRequest("Missing playback token");
  }

  const { path: segments } = await params;
  if (!Array.isArray(segments) || segments.length === 0 || segments.some((s) => !SEGMENT_PATTERN.test(s))) {
    return badRequest("Invalid media path");
  }

  const env = loadClientEnv();
  const base = env.NETRAM_MEDIAMTX_HLS_URL.replace(/\/+$/, "");
  const upstreamUrl = `${base}/${segments.join("/")}${request.nextUrl.search}`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: { Accept: "application/vnd.apple.mpegurl, */*" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return new NextResponse("Media server unavailable (HLS endpoint unreachable)", { status: 502 });
  }

  // Hook denies (401) and unknown paths (404) pass through honestly so the
  // UI can distinguish expired/ended sessions from offline cameras.
  if (!upstream.ok || upstream.body === null) {
    return new NextResponse(upstream.status === 404 ? "Not found" : "HLS upstream error", {
      status: upstream.status === 404 ? 404 : upstream.status,
    });
  }

  const contentType = upstream.headers.get("Content-Type") ?? "";
  const lastSegment = segments[segments.length - 1] ?? "";
  const isPlaylist =
    contentType.includes("mpegurl") ||
    contentType.includes("m3u8") ||
    lastSegment.endsWith(".m3u8");

  if (isPlaylist) {
    const text = await upstream.text();
    // Child URIs are relative to the playlist's own media path, so pass the
    // directory this playlist was served from.
    const dir = segments.slice(0, -1).join("/");

    return new NextResponse(rewritePlaylist(text, token, dir), {
      status: 200,
      headers: {
        "Content-Type": contentType.includes("mpegurl") || contentType.includes("m3u8")
          ? contentType
          : "application/vnd.apple.mpegurl",
        "Cache-Control": "no-store",
      },
    });
  }

  // Segments / init / gap media: stream through untouched.
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}
