/**
 * Media path contract (target architecture §4).
 *
 * The media path name (e.g. "facility-vani/cam-gate") is the ONLY camera
 * identifier that crosses into the media plane. Everything above the ingest
 * boundary speaks paths; RTSP URLs, facility IPs, and credentials never leave
 * the source-resolution layer.
 *
 * Phase 3 derivation (no schema change - §22): the media path is the path
 * component of the camera's `endpoint` column. Seed endpoints are aligned so
 * the rig camera yields exactly "facility-vani/cam-gate" (the MediaMTX path
 * the Phase 1–2 rig provisions). When Phase 4 adds an explicit mediaPath /
 * ingestMode schema, this module is the single place that changes.
 */

export interface CameraEndpointContext {
  /** Camera's DB `endpoint` value, e.g. "rtsp://facility-nvr:8554/facility-vani/cam-gate". */
  endpoint: string;
  provider: string;
  protocol: string;
}

/** Regex chars forbidden in a media path segment (MediaMTX path charset subset). */
const VALID_MEDIA_PATH = /^[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*$/;

/**
 * Derive the media path from a camera's endpoint. Throws on endpoints that
 * cannot yield a safe path - provisioning must fail closed, never guess.
 */
export function deriveMediaPath(camera: CameraEndpointContext): string {
  if (camera.protocol.toLowerCase() !== "rtsp") {
    throw new Error(
      `Camera protocol '${camera.protocol}' is not yet supported for media path derivation (provider: ${camera.provider})`,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(camera.endpoint);
  } catch {
    throw new Error(`Camera endpoint is not a valid URL: provider=${camera.provider}`);
  }
  if (parsed.protocol !== "rtsp:" && parsed.protocol !== "rtsps:") {
    throw new Error(`Camera endpoint scheme must be rtsp/rtsps: ${parsed.protocol}`);
  }

  // Strip leading slash; preserve facility/camera structure.
  const mediaPath = decodeURIComponent(parsed.pathname).replace(/^\/+/, "");
  if (!mediaPath || !VALID_MEDIA_PATH.test(mediaPath)) {
    throw new Error(`Camera endpoint does not yield a valid media path: ${camera.endpoint}`);
  }
  return mediaPath;
}

/**
 * Resolve the ingest source URI MediaMTX will pull for a camera.
 *
 * Resolution order:
 *  1. Dev override (`NETRAM_MEDIAMTX_DEV_INGEST_SOURCE`) - rig convenience,
 *     routes every RTSP camera at the single simulated facility feed. Empty
 *     in production-oriented deployments.
 *  2. The camera's own DB endpoint (server-side credentials only; never sent
 *     to browsers).
 */
export function resolveIngestSource(
  camera: CameraEndpointContext & { id: string },
  devIngestSource: string,
): string {
  if (devIngestSource.trim().length > 0) {
    return devIngestSource.trim();
  }
  return camera.endpoint;
}
