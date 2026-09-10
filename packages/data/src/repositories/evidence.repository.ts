import { eq } from "drizzle-orm";
import { evidence as evidenceTable, auditEvents, outboxEvents } from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type {
  AuditAction,
  DomainEventType,
  Evidence,
  EvidenceIntegrityState,
  EvidenceType,
} from "@netram/types";

export interface EvidenceRow {
  id: string;
  inspectionId: string;
  findingId: string | null;
  capturedAt: Date;
  latitude: number | null;
  longitude: number | null;
  evidenceType: EvidenceType;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  contentHash: string | null;
  storageKey: string | null;
  deviceId: string | null;
  uploadState: Evidence["uploadState"];
  integrityState: EvidenceIntegrityState;
  createdAt: Date;
}

export function toEvidence(row: EvidenceRow): Evidence {
  return {
    id: row.id,
    inspectionId: row.inspectionId,
    findingId: row.findingId,
    capturedAt: row.capturedAt.toISOString(),
    latitude: row.latitude,
    longitude: row.longitude,
    evidenceType: row.evidenceType,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    contentHash: row.contentHash,
    storageKey: row.storageKey,
    deviceId: row.deviceId,
    uploadState: row.uploadState,
    integrityState: row.integrityState,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface EvidenceWriteContext {
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface CaptureEvidenceWrite extends EvidenceWriteContext {
  id: string;
  inspectionId: string;
  findingId: string | null;
  capturedAt: Date;
  latitude: number | null;
  longitude: number | null;
  evidenceType: EvidenceType;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  contentHash: string | null;
  deviceId: string | null;
}

export interface UpdateEvidenceWrite extends EvidenceWriteContext {
  evidenceId: string;
  contentHash?: string;
  storageKey?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  integrityTo?: EvidenceIntegrityState;
}

export interface VerifyIntegrityWrite extends EvidenceWriteContext {
  evidenceId: string;
  to: EvidenceIntegrityState;
}

/**
 * Persistence for evidence metadata (§30). The media lives in object storage;
 * only metadata is authoritative here. All mutations plus audit and outbox are
 * atomic.
 */
export class EvidenceRepository {
  constructor(private db: DrizzleDB) {}

  async listByInspection(inspectionId: string): Promise<Evidence[]> {
    const rows = await this.db
      .select()
      .from(evidenceTable)
      .where(eq(evidenceTable.inspectionId, inspectionId));
    return rows.map((r) => toEvidence(r as unknown as EvidenceRow));
  }

  async findById(id: string): Promise<Evidence | null> {
    const rows = await this.db
      .select()
      .from(evidenceTable)
      .where(eq(evidenceTable.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return toEvidence(rows[0] as unknown as EvidenceRow);
  }

  async captureWithAuditAndEvent(cmd: CaptureEvidenceWrite): Promise<Evidence> {
    const created: Evidence = await this.db.transaction(async (tx) => {
      const rows = await tx
        .insert(evidenceTable)
        .values({
          id: cmd.id,
          inspectionId: cmd.inspectionId,
          findingId: cmd.findingId,
          capturedAt: cmd.capturedAt,
          latitude: cmd.latitude,
          longitude: cmd.longitude,
          evidenceType: cmd.evidenceType,
          fileName: cmd.fileName,
          mimeType: cmd.mimeType,
          sizeBytes: cmd.sizeBytes,
          contentHash: cmd.contentHash,
          deviceId: cmd.deviceId,
        })
        .returning();
      const row = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "evidence",
        resourceId: cmd.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata, inspectionId: cmd.inspectionId },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: cmd.id,
        actorUserId: cmd.actorUserId,
        resourceType: "evidence",
        resourceId: cmd.id,
        payload: {
          ...cmd.eventPayload,
          evidenceId: cmd.id,
          inspectionId: cmd.inspectionId,
        },
      });

      return toEvidence(row as unknown as EvidenceRow);
    });
    return created;
  }

  async markUploadedWithAuditAndEvent(cmd: UpdateEvidenceWrite): Promise<Evidence> {
    const updated: Evidence = await this.db.transaction(async (tx) => {
      const set: Record<string, unknown> = { uploadState: "uploaded" };
      if (cmd.contentHash !== undefined) set.contentHash = cmd.contentHash;
      if (cmd.storageKey !== undefined) set.storageKey = cmd.storageKey;
      if (cmd.fileName !== undefined) set.fileName = cmd.fileName;
      if (cmd.mimeType !== undefined) set.mimeType = cmd.mimeType;
      if (cmd.sizeBytes !== undefined) set.sizeBytes = cmd.sizeBytes;
      if (cmd.integrityTo !== undefined) set.integrityState = cmd.integrityTo;

      const rows = await tx
        .update(evidenceTable)
        .set(set)
        .where(eq(evidenceTable.id, cmd.evidenceId))
        .returning();
      const row = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "evidence",
        resourceId: cmd.evidenceId,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: cmd.evidenceId,
        actorUserId: cmd.actorUserId,
        resourceType: "evidence",
        resourceId: cmd.evidenceId,
        payload: { ...cmd.eventPayload, evidenceId: cmd.evidenceId },
      });

      return toEvidence(row as unknown as EvidenceRow);
    });
    return updated;
  }

  async verifyIntegrityWithAuditAndEvent(cmd: VerifyIntegrityWrite): Promise<Evidence> {
    const updated: Evidence = await this.db.transaction(async (tx) => {
      const rows = await tx
        .update(evidenceTable)
        .set({ integrityState: cmd.to })
        .where(eq(evidenceTable.id, cmd.evidenceId))
        .returning();
      const row = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "evidence",
        resourceId: cmd.evidenceId,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: cmd.evidenceId,
        actorUserId: cmd.actorUserId,
        resourceType: "evidence",
        resourceId: cmd.evidenceId,
        payload: {
          ...cmd.eventPayload,
          evidenceId: cmd.evidenceId,
          integrityState: cmd.to,
        },
      });

      return toEvidence(row as unknown as EvidenceRow);
    });
    return updated;
  }
}
