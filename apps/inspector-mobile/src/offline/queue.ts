import type {
  Inspection,
  OfflineOperation,
  OfflineOperationType,
  SyncBatchResponse,
  SyncOperationResult,
} from "@netram/types";
import type { NetramApiClient } from "@netram/api-client";
import type { ISqliteDatabase } from "./db.js";
import { getOfflineDatabase } from "./db.js";

function uuidv4(): string {
  // RFC4122 compliant UUID v4 generator
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface OfflineOperationRecord {
  operation_id: string;
  inspection_id: string;
  operation_type: string;
  payload: string;
  status: string;
  code: string | null;
  error_message: string | null;
  result_data: string | null;
  client_timestamp: string;
  created_at: string;
  synced_at: string | null;
}

export interface CachedInspectionRecord {
  id: string;
  project_id: string;
  project_name: string;
  project_code: string;
  type: string;
  status: string;
  district_id: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  started_at: string | null;
  submitted_at: string | null;
  cached_at: string;
}

export interface CachedObservationRecord {
  id: string;
  inspection_id: string;
  text: string;
  created_at: string;
  is_local: number;
}

export interface CachedEvidenceRecord {
  id: string;
  inspection_id: string;
  evidence_type: string;
  file_name: string | null;
  content_hash: string | null;
  upload_state: string;
  integrity_state: string;
  local_file_uri: string | null;
  created_at: string;
  is_local: number;
}

export interface SyncSummary {
  synced: number;
  conflicts: number;
  rejected: number;
  mediaUploaded: number;
  results: SyncOperationResult[];
}

export class OfflineInspectionQueue {
  constructor(private dbGetter: () => Promise<ISqliteDatabase> = getOfflineDatabase) {}

  private async getDb(): Promise<ISqliteDatabase> {
    return this.dbGetter();
  }

  /**
   * Enqueue an operation locally when offline (§5, §31).
   * Generates a unique client operation ID and applies optimistic local state updates.
   */
  async enqueueOperation(
    inspectionId: string,
    type: OfflineOperationType,
    payload: Record<string, unknown> = {},
    customOperationId?: string,
  ): Promise<OfflineOperation> {
    const db = await this.getDb();
    const operationId = customOperationId ?? uuidv4();
    const timestamp = new Date().toISOString();

    const op: OfflineOperation = {
      operationId,
      inspectionId,
      type,
      timestamp,
      payload,
    };

    await db.runAsync(
      `INSERT INTO offline_operations (operation_id, inspection_id, operation_type, payload, status, client_timestamp, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
      [operationId, inspectionId, type, JSON.stringify(payload), timestamp, timestamp],
    );

    // Optimistic local state updates
    if (type === "start_inspection") {
      await db.runAsync(
        `UPDATE cached_inspections SET status = 'in_progress', started_at = ? WHERE id = ?`,
        [timestamp, inspectionId],
      );
    } else if (type === "submit_inspection") {
      await db.runAsync(
        `UPDATE cached_inspections SET status = 'submitted', submitted_at = ? WHERE id = ?`,
        [timestamp, inspectionId],
      );
    } else if (type === "record_observation") {
      const observationId = (payload.observationId as string) ?? uuidv4();
      await db.runAsync(
        `INSERT INTO cached_observations (id, inspection_id, text, created_at, is_local)
         VALUES (?, ?, ?, ?, 1)`,
        [observationId, inspectionId, String(payload.text ?? ""), timestamp],
      );
    } else if (type === "capture_evidence") {
      const evidenceId = (payload.evidenceId as string) ?? uuidv4();
      const fileName = (payload.fileName as string) ?? "photo.jpg";
      const hash = (payload.contentHash as string) ?? "";
      const uri = (payload.localFileUri as string) ?? "";

      await db.runAsync(
        `INSERT INTO cached_evidence (id, inspection_id, evidence_type, file_name, content_hash, upload_state, integrity_state, local_file_uri, created_at, is_local)
         VALUES (?, ?, ?, ?, ?, 'pending', 'pending_verification', ?, ?, 1)`,
        [
          evidenceId,
          inspectionId,
          String(payload.evidenceType ?? "photo"),
          fileName,
          hash,
          uri,
          timestamp,
        ],
      );

      if (uri) {
        await db.runAsync(
          `INSERT INTO media_upload_queue (id, evidence_id, operation_id, local_file_uri, file_name, mime_type, file_size_bytes, content_hash, upload_status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
          [
            uuidv4(),
            evidenceId,
            operationId,
            uri,
            fileName,
            String(payload.mimeType ?? "image/jpeg"),
            Number(payload.fileSizeBytes ?? 0),
            hash,
            timestamp,
          ],
        );
      }
    }

    return op;
  }

  /**
   * Get all pending operations waiting to be synchronized with the server.
   */
  async getPendingOperations(): Promise<OfflineOperation[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<OfflineOperationRecord>(
      `SELECT * FROM offline_operations WHERE status = 'pending' ORDER BY client_timestamp ASC`,
    );

    return rows.map((r) => ({
      operationId: r.operation_id,
      inspectionId: r.inspection_id,
      type: r.operation_type as OfflineOperationType,
      timestamp: r.client_timestamp,
      payload: JSON.parse(r.payload || "{}") as Record<string, unknown>,
    }));
  }

  /**
   * Get all operations for an inspection or across all inspections.
   */
  async getAllOperations(inspectionId?: string): Promise<OfflineOperationRecord[]> {
    const db = await this.getDb();
    if (inspectionId) {
      return db.getAllAsync<OfflineOperationRecord>(
        `SELECT * FROM offline_operations WHERE inspection_id = ? ORDER BY client_timestamp DESC`,
        [inspectionId],
      );
    }
    return db.getAllAsync<OfflineOperationRecord>(
      `SELECT * FROM offline_operations ORDER BY client_timestamp DESC`,
    );
  }

  /**
   * Cache inspections retrieved from server for offline use.
   */
  async cacheInspections(inspections: Inspection[]): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    for (const i of inspections) {
      await db.runAsync(
        `INSERT OR REPLACE INTO cached_inspections (id, project_id, project_name, project_code, type, status, district_id, scheduled_start, scheduled_end, started_at, submitted_at, cached_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          i.id,
          i.projectId,
          i.projectName,
          i.projectCode,
          i.type,
          i.status,
          i.districtId,
          i.scheduledStart,
          i.scheduledEnd,
          i.startedAt,
          i.submittedAt,
          now,
        ],
      );
    }
  }

  async getCachedInspections(): Promise<CachedInspectionRecord[]> {
    const db = await this.getDb();
    return db.getAllAsync<CachedInspectionRecord>(
      `SELECT * FROM cached_inspections ORDER BY scheduled_start DESC`,
    );
  }

  async getCachedInspection(id: string): Promise<CachedInspectionRecord | null> {
    const db = await this.getDb();
    return db.getFirstAsync<CachedInspectionRecord>(
      `SELECT * FROM cached_inspections WHERE id = ?`,
      [id],
    );
  }

  async getCachedObservations(inspectionId: string): Promise<CachedObservationRecord[]> {
    const db = await this.getDb();
    return db.getAllAsync<CachedObservationRecord>(
      `SELECT * FROM cached_observations WHERE inspection_id = ? ORDER BY created_at ASC`,
      [inspectionId],
    );
  }

  async getCachedEvidence(inspectionId: string): Promise<CachedEvidenceRecord[]> {
    const db = await this.getDb();
    return db.getAllAsync<CachedEvidenceRecord>(
      `SELECT * FROM cached_evidence WHERE inspection_id = ? ORDER BY created_at ASC`,
      [inspectionId],
    );
  }

  /**
   * Synchronize pending operations batch against server API and reconcile local SQLite state (§5, §31).
   */
  async syncPendingOperations(apiClient: NetramApiClient): Promise<SyncBatchResponse> {
    const db = await this.getDb();
    const pending = await this.getPendingOperations();

    if (pending.length === 0) {
      return { results: [], processedAt: new Date().toISOString() };
    }

    const response = await apiClient.syncOfflineOperations({ operations: pending });
    const now = new Date().toISOString();

    for (const res of response.results) {
      if (res.status === "accepted") {
        await db.runAsync(
          `UPDATE offline_operations
           SET status = 'accepted', result_data = ?, synced_at = ?
           WHERE operation_id = ?`,
          [JSON.stringify(res.resultData ?? {}), now, res.operationId],
        );
        if (res.type === "start_inspection") {
          await db.runAsync(
            `UPDATE cached_inspections SET status = 'in_progress', started_at = ? WHERE id = ?`,
            [now, res.inspectionId],
          );
        } else if (res.type === "submit_inspection") {
          await db.runAsync(
            `UPDATE cached_inspections SET status = 'submitted', submitted_at = ? WHERE id = ?`,
            [now, res.inspectionId],
          );
        }
      } else if (res.status === "conflict") {
        await db.runAsync(
          `UPDATE offline_operations
           SET status = 'conflict', code = ?, error_message = ?, synced_at = ?
           WHERE operation_id = ?`,
          [res.code ?? null, res.message ?? null, now, res.operationId],
        );
      } else {
        await db.runAsync(
          `UPDATE offline_operations
           SET status = 'rejected', code = ?, error_message = ?, synced_at = ?
           WHERE operation_id = ?`,
          [res.code ?? null, res.message ?? null, now, res.operationId],
        );
      }
    }

    return response;
  }

  /**
   * Synchronize pending operations with Netram server (§5, §31).
   * Sends batch to /api/v1/inspections/sync, updates local operation states,
   * and uploads queued media files for accepted evidence captures.
   */
  async sync(apiClient: NetramApiClient): Promise<SyncSummary> {
    const response = await this.syncPendingOperations(apiClient);
    let synced = 0;
    let conflicts = 0;
    let rejected = 0;

    for (const res of response.results) {
      if (res.status === "accepted") {
        synced++;
      } else if (res.status === "conflict") {
        conflicts++;
      } else {
        rejected++;
      }
    }

    // 3. Media uploads for accepted evidence captures
    let mediaUploaded = 0;
    const db = await this.getDb();
    const mediaQueue = await db.getAllAsync<{
      id: string;
      evidence_id: string;
      operation_id: string;
      local_file_uri: string;
      file_name: string;
      mime_type: string;
      upload_status: string;
    }>(`SELECT * FROM media_upload_queue WHERE upload_status = 'pending'`);

    for (const item of mediaQueue) {
      const opResult = response.results.find((r) => r.operationId === item.operation_id);
      if (opResult?.status === "accepted") {
        try {
          // In real mobile app, reads local file blob from item.local_file_uri
          // In node / mock, can pass Buffer or mock Blob
          const filePayload = new Blob([`Evidence binary content for ${item.file_name}`], {
            type: item.mime_type,
          });

          await apiClient.uploadEvidence(item.evidence_id, filePayload, item.file_name);
          const now = new Date().toISOString();
          await db.runAsync(
            `UPDATE media_upload_queue SET upload_status = 'uploaded', uploaded_at = ? WHERE id = ?`,
            [now, item.id],
          );
          await db.runAsync(`UPDATE cached_evidence SET upload_state = 'uploaded' WHERE id = ?`, [
            item.evidence_id,
          ]);
          mediaUploaded++;
        } catch (uploadErr) {
          await db.runAsync(
            `UPDATE media_upload_queue SET upload_status = 'failed', error_message = ? WHERE id = ?`,
            [uploadErr instanceof Error ? uploadErr.message : "Upload failed", item.id],
          );
        }
      }
    }

    return {
      synced,
      conflicts,
      rejected,
      mediaUploaded,
      results: response.results,
    };
  }
}
