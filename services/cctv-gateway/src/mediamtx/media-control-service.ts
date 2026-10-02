/**
 * Media control bridge (Phase 3) - the gateway's media-plane operations layer.
 *
 * Sits between the HTTP surface and the MediaMTX client + provider registry:
 *   HTTP routes → MediaControlService → MediamtxClient (control API)
 *                                      → provider registry (source resolution)
 *
 * Responsibilities: path provisioning, health derivation from REAL media
 * state, statistics, playback-contract preparation. It carries NO media bytes
 * - MediaMTX owns the data plane (target architecture §26).
 */

import type { MediamtxClient, MediamtxPathState } from "./client.js";
import { deriveMediaPath, resolveIngestSource } from "./media-path.js";
import { verifyStreamToken } from "../auth/token.js";
import type { CameraProvider } from "../providers/provider.js";

/** Camera context the NETRAM API passes with control-plane requests. */
export interface CameraContext {
  id: string;
  provider: string;
  protocol: string;
  endpoint: string;
}

export type CameraHealthState = "online" | "offline" | "degraded" | "unknown";

export interface CameraHealthResult {
  cameraId: string;
  status: CameraHealthState;
  latencyMs: number | undefined;
  lastCheckedAt: string;
  details: Record<string, unknown>;
}

export interface PlaybackContract {
  protocol: "webrtc";
  whepUrl: string;
  token: string;
  streamId: string;
  cameraId: string;
  mediaPath: string;
  expiresAt: string;
}

export interface PathStatistics {
  mediaPath: string;
  exists: boolean;
  ready: boolean;
  available: boolean;
  online: boolean;
  readerCount: number;
  sourceType: string | null;
  bytesSent: number;
}

export interface MediaControlServiceOptions {
  mediamtx: MediamtxClient;
  /** Provider registry - resolves/validates the camera source for provisioning. */
  providers: CameraProvider;
  whepPublicUrl: string;
  devIngestSource: string;
  /** Secret for verifying playback tokens presented to token-verify/dev tools. */
  streamSecret: string;
  onDemandStartTimeout?: string;
  onDemandCloseAfter?: string;
}

/**
 * Health semantics (Phase 3 §10 - derived from LIVE-VERIFIED MediaMTX state;
 * a configured-but-idle on-demand path reports ready:false, available:false,
 * online:true, readyTime:null):
 *
 *  online    - path exists AND ready (stream flowing now).
 *  degraded  - path exists, not ready, but has delivered a stream before in
 *              this MediaMTX process (readyTime set): source previously
 *              worked but is not flowing now (on-demand idle after history,
 *              or source lost). details distinguish via available/readers.
 *  offline   - path not provisioned, MediaMTX control API unreachable, or
 *              the source has never delivered (readyTime null). "Stream is
 *              not actually available" - never a DB-row-only claim.
 *  unknown   - defensive: path reports ready but no interpretable source.
 *
 * A camera is NEVER reported online merely because a DB row exists.
 */
export class MediaControlService {
  private readonly mediamtx: MediamtxClient;
  private readonly providers: CameraProvider;
  private readonly whepPublicUrl: string;
  private readonly devIngestSource: string;
  private readonly streamSecret: string;
  private readonly onDemandStartTimeout: string;
  private readonly onDemandCloseAfter: string;

  constructor(options: MediaControlServiceOptions) {
    this.mediamtx = options.mediamtx;
    this.providers = options.providers;
    this.whepPublicUrl = options.whepPublicUrl.replace(/\/+$/, "");
    this.devIngestSource = options.devIngestSource;
    this.streamSecret = options.streamSecret;
    this.onDemandStartTimeout = options.onDemandStartTimeout ?? "10s";
    this.onDemandCloseAfter = options.onDemandCloseAfter ?? "20s";
  }

  /** Deterministic media path for a camera (fails closed on bad endpoints). */
  mediaPathFor(camera: CameraContext): string {
    return deriveMediaPath(camera);
  }

  /**
   * Ensure MediaMTX knows the camera's path with its resolved ingest source.
   * Idempotent; safe to call on every stream request.
   */
  async ensureCameraPath(camera: CameraContext): Promise<{ mediaPath: string; created: boolean }> {
    const mediaPath = this.mediaPathFor(camera);

    // The provider layer validates that this camera exists and its source is
    // resolvable before anything is provisioned in the media server.
    const source = await this.providers.acquireRawStream(camera.id);
    const ingestSource = resolveIngestSource({ ...camera, id: camera.id }, this.devIngestSource);
    if (source.length === 0 && ingestSource.length === 0) {
      throw new Error(`No resolvable ingest source for camera: ${camera.id}`);
    }

    const result = await this.mediamtx.ensurePath(mediaPath, {
      source: ingestSource,
      sourceOnDemand: true,
      sourceOnDemandStartTimeout: this.onDemandStartTimeout,
      sourceOnDemandCloseAfter: this.onDemandCloseAfter,
    });
    return { mediaPath, created: result.created };
  }

  /** Real health derived from MediaMTX state - never from DB existence. */
  async cameraHealth(camera: CameraContext): Promise<CameraHealthResult> {
    const lastCheckedAt = new Date().toISOString();
    const startedAt = Date.now();
    const mediaPath = this.mediaPathFor(camera);

    let path: MediamtxPathState | null;
    try {
      path = await this.mediamtx.getPath(mediaPath);
    } catch (err) {
      return {
        cameraId: camera.id,
        status: "offline",
        latencyMs: undefined,
        lastCheckedAt,
        details: {
          mediaPath,
          reason: "mediamtx_unreachable",
          error: err instanceof Error ? err.message : String(err),
        },
      };
    }

    const latencyMs = Date.now() - startedAt;

    if (!path) {
      return {
        cameraId: camera.id,
        status: "offline",
        latencyMs,
        lastCheckedAt,
        details: { mediaPath, reason: "path_not_provisioned" },
      };
    }

    if (path.ready) {
      return {
        cameraId: camera.id,
        status: "online",
        latencyMs,
        lastCheckedAt,
        details: {
          mediaPath,
          readers: path.readers.length,
          sourceType: path.source?.type ?? null,
        },
      };
    }

    const hasDeliveredBefore = path.readyTime !== null;
    return {
      cameraId: camera.id,
      status: hasDeliveredBefore ? "degraded" : "offline",
      latencyMs,
      lastCheckedAt,
      details: {
        mediaPath,
        reason: hasDeliveredBefore ? "not_ready_has_history" : "source_never_delivered",
        online: path.online,
        available: path.available,
        readers: path.readers.length,
      },
    };
  }

  /** Path-level media statistics (readers, readiness, traffic). */
  async pathStatistics(camera: CameraContext): Promise<PathStatistics> {
    const mediaPath = this.mediaPathFor(camera);
    const stats = await this.mediamtx.getPathStats(mediaPath);
    if (!stats) {
      return {
        mediaPath,
        exists: false,
        ready: false,
        available: false,
        online: false,
        readerCount: 0,
        sourceType: null,
        bytesSent: 0,
      };
    }
    return { mediaPath, ...stats };
  }

  /**
   * Prepare the playback contract for an authorized viewer: provision the
   * path, then mint a browser-facing WHEP URL + short-lived scoped token.
   * No RTSP URL, facility IP, or credential is ever included.
   */
  async preparePlayback(
    camera: CameraContext,
    input: { streamId: string; token: string; expiresAt: string },
  ): Promise<PlaybackContract> {
    const { mediaPath } = await this.ensureCameraPath(camera);
    return {
      protocol: "webrtc",
      whepUrl: `${this.whepPublicUrl}/${mediaPath}/whep`,
      token: input.token,
      streamId: input.streamId,
      cameraId: camera.id,
      mediaPath,
      expiresAt: input.expiresAt,
    };
  }

  /**
   * Verify a playback token's signature/expiry and check it against the LIVE
   * media state: the token's mediaPath must still exist in MediaMTX. Signature
   * validity alone does not prove the stream is still running - this is what
   * the NETRAM API's external auth hook layers session state on top of.
   */
  async verifyPlaybackToken(
    token: string,
  ): Promise<
    | { valid: true; streamId: string; cameraId: string; mediaPath: string; expiresAt: string }
    | { valid: false; reason: string }
  > {
    const payload = verifyStreamToken(token, this.streamSecret);
    if (!payload) {
      return { valid: false, reason: "invalid_or_expired_token" };
    }
    let pathExists: boolean;
    try {
      pathExists = (await this.mediamtx.getPath(payload.mediaPath)) !== null;
    } catch (err) {
      return {
        valid: false,
        reason: `mediamtx_unreachable: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    if (!pathExists) {
      return { valid: false, reason: "media_path_not_provisioned" };
    }
    return {
      valid: true,
      streamId: payload.streamId,
      cameraId: payload.cameraId,
      mediaPath: payload.mediaPath,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    };
  }

  /**
   * Live viewer state for a session's media path: how many MediaMTX readers
   * are currently consuming it. Used for reconciliation by the API sweeper.
   */
  /**
   * Phase 5 reader correlation: kick every MediaMTX WebRTC reader whose WHEP
   * query carries this NETRAM session id (see MediamtxClient.
   * kickReadersByNetramSession). Returns the number of readers disconnected.
   */
  async kickSessionReaders(netramSessionId: string): Promise<number> {
    return this.mediamtx.kickReadersByNetramSession(netramSessionId);
  }

  async sessionView(mediaPath: string): Promise<{
    mediaPath: string;
    readerCount: number;
    ready: boolean;
  }> {
    const path = await this.mediamtx.getPath(mediaPath);
    return {
      mediaPath,
      readerCount: path?.readers.length ?? 0,
      ready: path?.ready ?? false,
    };
  }
}
