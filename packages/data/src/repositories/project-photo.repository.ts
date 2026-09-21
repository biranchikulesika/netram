import { eq, desc } from "drizzle-orm";
import { projectPhotos as projectPhotosTable, auditEvents, outboxEvents } from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type { AuditAction, DomainEventType, ProjectPhoto, UUID } from "@netram/types";

export interface ProjectPhotoRow {
  id: string;
  projectId: string;
  uploadedBy: string | null;
  capturedAt: Date;
  caption: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  contentHash: string | null;
  storageKey: string | null;
  createdAt: Date;
}

export function toProjectPhoto(row: ProjectPhotoRow): ProjectPhoto {
  return {
    id: row.id,
    projectId: row.projectId,
    uploadedBy: row.uploadedBy,
    capturedAt: row.capturedAt.toISOString(),
    caption: row.caption,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    contentHash: row.contentHash,
    storageKey: row.storageKey,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface CreateProjectPhotoWrite {
  id: UUID;
  projectId: UUID;
  uploadedBy: UUID;
  capturedAt: Date;
  caption: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number;
  contentHash: string;
  storageKey: string;
  actorUserId: UUID | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

/**
 * Persistence for a project photo: the media lives in object storage (§30); this
 * row plus the content hash are the authoritative record. All mutations plus
 * audit and outbox are atomic.
 */
export class ProjectPhotoRepository {
  constructor(private db: DrizzleDB) {}

  async createWithAuditAndEvent(cmd: CreateProjectPhotoWrite): Promise<ProjectPhoto> {
    const created: ProjectPhoto = await this.db.transaction(async (tx) => {
      const rows = await tx
        .insert(projectPhotosTable)
        .values({
          id: cmd.id,
          projectId: cmd.projectId,
          uploadedBy: cmd.uploadedBy,
          capturedAt: cmd.capturedAt,
          caption: cmd.caption,
          fileName: cmd.fileName,
          mimeType: cmd.mimeType,
          sizeBytes: cmd.sizeBytes,
          contentHash: cmd.contentHash,
          storageKey: cmd.storageKey,
        })
        .returning();
      const row = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "project_photo",
        resourceId: cmd.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata, projectId: cmd.projectId },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: cmd.id,
        actorUserId: cmd.actorUserId,
        resourceType: "project_photo",
        resourceId: cmd.id,
        payload: { ...cmd.eventPayload, projectId: cmd.projectId },
      });

      return toProjectPhoto(row as unknown as ProjectPhotoRow);
    });
    return created;
  }

  async listByProject(projectId: UUID): Promise<ProjectPhoto[]> {
    const rows = await this.db
      .select()
      .from(projectPhotosTable)
      .where(eq(projectPhotosTable.projectId, projectId))
      .orderBy(desc(projectPhotosTable.capturedAt));
    return rows.map((r) => toProjectPhoto(r as unknown as ProjectPhotoRow));
  }

  async findById(id: UUID): Promise<ProjectPhoto | null> {
    const rows = await this.db
      .select()
      .from(projectPhotosTable)
      .where(eq(projectPhotosTable.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return toProjectPhoto(rows[0] as unknown as ProjectPhotoRow);
  }
}
