import { randomUUID, createHash } from "node:crypto";
import type { Readable } from "node:stream";
import { AppError } from "../../../infrastructure/errors.js";
import type { ObjectStoragePort } from "../../../infrastructure/object-storage.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { ProjectService } from "./project-service.js";
import type { ProjectPhotoRepositoryPort } from "./ports/project-photo-repository.js";
import type { ProjectPhoto } from "@netram/types";

const CREATE = "project:create" as const;
const READ = "project:read" as const;

export interface UploadProjectPhotoInput {
  data: Buffer;
  capturedAt: string;
  caption?: string;
  fileName?: string;
  mimeType?: string;
}

/**
 * Project photos are a visual record of the project (gate, rooms, kitchen…).
 * The media is stored in object storage; this row records who uploaded it
 * (§34/§30). `uploadedBy` is the acting user from the request context.
 */
export class ProjectPhotoService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly projects: Pick<ProjectService, "getProject">,
    private readonly repository: ProjectPhotoRepositoryPort,
    private readonly storage: ObjectStoragePort,
  ) {}

  async listPhotos(ctx: RequestUserContext, projectId: string): Promise<ProjectPhoto[]> {
    await this.projects.getProject(ctx, projectId);
    return this.repository.listByProject(projectId);
  }

  async uploadPhoto(
    ctx: RequestUserContext,
    projectId: string,
    input: UploadProjectPhotoInput,
  ): Promise<ProjectPhoto> {
    const project = await this.projects.getProject(ctx, projectId);
    this.authz.requirePermission(ctx, CREATE, {
      districtId: project.districtId,
    });

    const id = randomUUID();
    const contentHash = `sha256:${createHash("sha256").update(input.data).digest("hex")}`;
    const storageKey = `projects/${projectId}/photos/${id}`;
    await this.storage.put(storageKey, input.data, input.mimeType ?? null);

    return this.repository.createWithAuditAndEvent({
      id,
      projectId,
      uploadedBy: ctx.userId,
      capturedAt: new Date(input.capturedAt),
      caption: input.caption ?? null,
      fileName: input.fileName ?? null,
      mimeType: input.mimeType ?? null,
      sizeBytes: input.data.byteLength,
      contentHash,
      storageKey,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "project.photo_uploaded",
      auditMetadata: { fileName: input.fileName ?? null, sizeBytes: input.data.byteLength },
      eventType: "project.photo_uploaded",
      eventPayload: { capturedAt: input.capturedAt },
    });
  }

  async getPhotoContent(
    ctx: RequestUserContext,
    photoId: string,
  ): Promise<{ photo: ProjectPhoto; stream: Readable }> {
    const photo = await this.repository.findById(photoId);
    if (!photo) throw AppError.notFound("Project photo not found.");
    const project = await this.projects.getProject(ctx, photo.projectId);
    this.authz.requirePermission(ctx, READ, {
      districtId: project.districtId,
    });
    if (!photo.storageKey) throw AppError.conflict("Project photo has no stored object.");
    const stream = await this.storage.get(photo.storageKey);
    return { photo, stream };
  }
}
