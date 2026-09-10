import { desc, eq } from "drizzle-orm";
import { inspectionSyncOperations as syncTable, auditEvents, outboxEvents } from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type {
  AuditAction,
  DomainEventType,
  OfflineOperationStatus,
  OfflineOperationType,
  SyncOperationResult,
} from "@netram/types";

export interface SyncOperationRow {
  id: string;
  inspectionId: string;
  userId: string;
  operationType: string;
  payload: Record<string, unknown>;
  status: string;
  code: string | null;
  message: string | null;
  resultData: Record<string, unknown> | null;
  clientTimestamp: Date;
  processedAt: Date;
}

export function toSyncOperationResult(row: SyncOperationRow): SyncOperationResult {
  return {
    operationId: row.id,
    inspectionId: row.inspectionId,
    type: row.operationType as OfflineOperationType,
    status: row.status as OfflineOperationStatus,
    code: row.code ?? undefined,
    message: row.message ?? undefined,
    resultData: row.resultData ?? undefined,
    syncedAt: row.processedAt.toISOString(),
  };
}

export interface RecordSyncOperationWrite {
  operationId: string;
  inspectionId: string;
  userId: string;
  operationType: OfflineOperationType;
  payload: Record<string, unknown>;
  status: OfflineOperationStatus;
  code?: string;
  message?: string;
  resultData?: Record<string, unknown>;
  clientTimestamp: string;
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export class InspectionSyncRepository {
  constructor(private db: DrizzleDB) {}

  async findById(operationId: string): Promise<SyncOperationResult | null> {
    const rows = await this.db
      .select()
      .from(syncTable)
      .where(eq(syncTable.id, operationId))
      .limit(1);
    if (rows.length === 0) return null;
    return toSyncOperationResult(rows[0] as unknown as SyncOperationRow);
  }

  async listByInspection(inspectionId: string): Promise<SyncOperationResult[]> {
    const rows = await this.db
      .select()
      .from(syncTable)
      .where(eq(syncTable.inspectionId, inspectionId))
      .orderBy(desc(syncTable.processedAt));
    return rows.map((r) => toSyncOperationResult(r as unknown as SyncOperationRow));
  }

  async recordResultWithAuditAndEvent(cmd: RecordSyncOperationWrite): Promise<SyncOperationResult> {
    const res: SyncOperationResult = await this.db.transaction(async (tx) => {
      const rows = await tx
        .insert(syncTable)
        .values({
          id: cmd.operationId,
          inspectionId: cmd.inspectionId,
          userId: cmd.userId,
          operationType: cmd.operationType,
          payload: cmd.payload,
          status: cmd.status,
          code: cmd.code ?? null,
          message: cmd.message ?? null,
          resultData: cmd.resultData ?? null,
          clientTimestamp: new Date(cmd.clientTimestamp),
        })
        .returning();

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "inspection_sync_operation",
        resourceId: cmd.operationId,
        metadata: cmd.auditMetadata,
        ipAddress: cmd.ipAddress,
        requestId: cmd.requestId,
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: cmd.requestId ?? cmd.operationId,
        actorUserId: cmd.actorUserId,
        resourceType: "inspection_sync_operation",
        resourceId: cmd.operationId,
        payload: cmd.eventPayload,
      });

      return toSyncOperationResult(rows[0] as unknown as SyncOperationRow);
    });

    return res;
  }
}
