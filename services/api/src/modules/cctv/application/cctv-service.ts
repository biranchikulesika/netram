import { AppError } from "../../../infrastructure/errors.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { CctvRepositoryPort } from "./ports/cctv-repository.js";
import type {
  AuthorizedStream,
  CameraHealthStatus,
  CctvCamera,
  ListCamerasFilter,
  PublicCctvCamera,
} from "@netram/types";

const CCTV_READ = "cctv:read" as const;
const CCTV_STREAM = "cctv:stream" as const;

export function toPublicCctvCamera(camera: CctvCamera): PublicCctvCamera {
  const { endpoint: _endpoint, ...publicCam } = camera;
  return publicCam;
}

/**
 * CCTV domain and streaming application service (AGENTS.md §7, §42).
 * Strictly omits raw RTSP credentials and endpoints from all public/client contracts.
 * Coordinates with the CCTV Gateway for signed relay URLs and snapshots.
 */
export class CctvService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly cctvRepo: CctvRepositoryPort,
    private readonly gatewayUrl: string,
  ) {}

  async listCameras(
    ctx: RequestUserContext,
    query: ListCamerasFilter = {},
  ): Promise<{
    items: PublicCctvCamera[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    this.authz.requirePermission(ctx, CCTV_READ);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const scope = this.authz.accessibleDistrictIds(ctx);

    const result = await this.cctvRepo.list({
      page,
      pageSize,
      districtId: query.districtId,
      status: query.status,
      jurisdictionIds: scope ? [...scope] : undefined,
    });

    return {
      items: result.items.map(toPublicCctvCamera),
      total: result.total,
      page,
      pageSize,
    };
  }

  async getCamera(ctx: RequestUserContext, id: string): Promise<PublicCctvCamera> {
    this.authz.requirePermission(ctx, CCTV_READ);

    const camera = await this.cctvRepo.findById(id);
    if (!camera) {
      throw AppError.notFound("CCTV camera not found.");
    }

    if (camera.districtId && !this.authz.canAccessDistrict(ctx, camera.districtId)) {
      throw AppError.forbidden("Access denied to camera outside authorized jurisdiction.");
    }

    return toPublicCctvCamera(camera);
  }

  async getCameraHealth(ctx: RequestUserContext, id: string): Promise<CameraHealthStatus> {
    this.authz.requirePermission(ctx, CCTV_READ);

    const camera = await this.cctvRepo.findById(id);
    if (!camera) {
      throw AppError.notFound("CCTV camera not found.");
    }

    if (camera.districtId && !this.authz.canAccessDistrict(ctx, camera.districtId)) {
      throw AppError.forbidden("Access denied to camera outside authorized jurisdiction.");
    }

    try {
      const res = await fetch(`${this.gatewayUrl}/cameras/${encodeURIComponent(id)}/health`);
      if (!res.ok) {
        return {
          cameraId: id,
          status: "degraded",
          lastCheckedAt: new Date().toISOString(),
          details: { gatewayStatus: res.status },
        };
      }
      const data = (await res.json()) as {
        status?: CameraHealthStatus["status"];
        latencyMs?: number;
      };
      return {
        cameraId: id,
        status: data.status ?? "online",
        latencyMs: data.latencyMs,
        lastCheckedAt: new Date().toISOString(),
      };
    } catch {
      return {
        cameraId: id,
        status: "offline",
        lastCheckedAt: new Date().toISOString(),
        details: { error: "Gateway unreachable" },
      };
    }
  }

  async requestCameraStream(
    ctx: RequestUserContext,
    id: string,
    input: { ttlSeconds?: number } = {},
  ): Promise<AuthorizedStream> {
    this.authz.requirePermission(ctx, CCTV_STREAM);

    const camera = await this.cctvRepo.findById(id);
    if (!camera) {
      throw AppError.notFound("CCTV camera not found.");
    }

    if (camera.districtId && !this.authz.canAccessDistrict(ctx, camera.districtId)) {
      throw AppError.forbidden("Access denied to camera outside authorized jurisdiction.");
    }

    let streamData: AuthorizedStream;
    try {
      const res = await fetch(`${this.gatewayUrl}/cameras/${encodeURIComponent(id)}/streams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ttlSeconds: input.ttlSeconds }),
      });

      if (!res.ok) {
        throw new Error(`CCTV Gateway returned status ${res.status}`);
      }

      streamData = (await res.json()) as AuthorizedStream;
    } catch (err) {
      throw new AppError("SERVICE_UNAVAILABLE", "Unable to establish authorized stream relay.", {
        cause: err instanceof Error ? err.message : String(err),
      });
    }

    await this.cctvRepo.createStreamSession(
      {
        cameraId: id,
        sessionId: streamData.streamId,
      },
      {
        actorUserId: ctx.user.id,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        auditAction: "cctv.accessed",
        auditMetadata: {
          cameraId: id,
          streamId: streamData.streamId,
          expiresAt: streamData.expiresAt,
        },
        eventType: "cctv.stream_started",
        eventPayload: {
          cameraId: id,
          streamId: streamData.streamId,
          startedAt: new Date().toISOString(),
        },
      },
    );

    return streamData;
  }

  async getCameraSnapshot(
    ctx: RequestUserContext,
    id: string,
  ): Promise<{ data: Buffer; contentType: string }> {
    this.authz.requirePermission(ctx, CCTV_READ);

    const camera = await this.cctvRepo.findById(id);
    if (!camera) {
      throw AppError.notFound("CCTV camera not found.");
    }

    if (camera.districtId && !this.authz.canAccessDistrict(ctx, camera.districtId)) {
      throw AppError.forbidden("Access denied to camera outside authorized jurisdiction.");
    }

    try {
      const res = await fetch(`${this.gatewayUrl}/cameras/${encodeURIComponent(id)}/snapshot`);
      if (!res.ok) {
        throw new Error(`Gateway returned status ${res.status}`);
      }
      const arrayBuffer = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") || "image/jpeg";
      return {
        data: Buffer.from(arrayBuffer),
        contentType,
      };
    } catch (err) {
      throw new AppError("SERVICE_UNAVAILABLE", "Failed to retrieve camera snapshot frame.", {
        cause: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
