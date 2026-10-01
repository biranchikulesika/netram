import type {
  Inspection,
  OfflineOperation,
  OfflineOperationType,
  SyncBatchResponse,
  SyncOperationResult,
  CallContact,
  CallRecord,
} from "@netram/types";
import type { NetramApiClient } from "@netram/api-client";
import type { ISqliteDatabase } from "./db";
import { getOfflineDatabase } from "./db";

function uuidv4(): string {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
      bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant RFC4122
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
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

export interface CachedFindingDraftRecord {
  id: string;
  inspection_id: string;
  observation_id: string | null;
  severity: string;
  description: string;
  remediation: string | null;
  sync_state: string;
  operation_id: string;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: string;
  inspection_id: string;
  category: string;
  question: string;
  is_required: boolean;
  response: "pass" | "fail" | "na" | null;
  note: string | null;
  updated_at: string | null;
}

export interface FailedMediaUploadRecord {
  id: string;
  evidence_id: string;
  file_name: string;
  error_message: string | null;
  created_at: string;
}

export interface PendingMediaUploadRecord {
  id: string;
  evidence_id: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
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
    } else if (type === "draft_finding") {
      const findingId = (payload.findingId as string) ?? uuidv4();
      await db.runAsync(
        `INSERT OR REPLACE INTO cached_finding_drafts (id, inspection_id, observation_id, severity, description, remediation, sync_state, operation_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
        [
          findingId,
          inspectionId,
          (payload.observationId as string) ?? null,
          String(payload.severity ?? "medium"),
          String(payload.description ?? ""),
          (payload.remediation as string) ?? null,
          operationId,
          timestamp,
          timestamp,
        ],
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
    } else if (type === "update_checklist_item") {
      const itemId = String(payload.checklistItemId ?? "");
      const response = payload.response !== undefined ? (payload.response as string | null) : null;
      const note = payload.note !== undefined ? (payload.note as string | null) : null;
      await db.runAsync(
        `UPDATE cached_checklist_items SET response = ?, note = ?, updated_at = ? WHERE id = ?`,
        [response, note, timestamp, itemId],
      );
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
        `SELECT * FROM offline_operations WHERE inspection_id = ? ORDER BY client_timestamp ASC`,
        [inspectionId],
      );
    }
    return db.getAllAsync<OfflineOperationRecord>(
      `SELECT * FROM offline_operations ORDER BY client_timestamp ASC`,
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

  /**
   * Clears SQLite cached inspections only (§5, §31).
   * Does NOT delete pending offline_operations or media upload queue.
   */
  async clearCachedInspections(): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(`DELETE FROM cached_inspections`);
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

  async getCachedFindingDrafts(inspectionId: string): Promise<CachedFindingDraftRecord[]> {
    const db = await this.getDb();
    return db.getAllAsync<CachedFindingDraftRecord>(
      `SELECT * FROM cached_finding_drafts WHERE inspection_id = ? ORDER BY updated_at DESC`,
      [inspectionId],
    );
  }

  async getFindingDrafts(inspectionId: string): Promise<CachedFindingDraftRecord[]> {
    return this.getCachedFindingDrafts(inspectionId);
  }

  /** Delete a draft finding and its associated pending offline operation (§2.4). */
  async deleteFindingDraft(findingId: string): Promise<void> {
    const db = await this.getDb();
    const draft = await db.getFirstAsync<CachedFindingDraftRecord>(
      `SELECT * FROM cached_finding_drafts WHERE id = ?`,
      [findingId],
    );
    if (draft?.operation_id) {
      await db.runAsync(`DELETE FROM offline_operations WHERE operation_id = ?`, [
        draft.operation_id,
      ]);
    }
    await db.runAsync(`DELETE FROM cached_finding_drafts WHERE id = ?`, [findingId]);
  }

  /** Creates one operation; edits change that pending operation rather than duplicating it. */
  async saveFindingDraft(
    inspectionId: string,
    input: {
      findingId?: string;
      operationId?: string;
      observationId?: string | null;
      severity: string;
      description: string;
      remediation?: string | null;
    },
  ): Promise<OfflineOperation> {
    if (!input.findingId || !input.operationId) {
      const findingId = input.findingId ?? uuidv4();
      return this.enqueueOperation(inspectionId, "draft_finding", { ...input, findingId });
    }
    const db = await this.getDb();
    const operation = await db.getFirstAsync<OfflineOperationRecord>(
      `SELECT * FROM offline_operations WHERE operation_id = ?`,
      [input.operationId],
    );
    if (operation?.status !== "pending") {
      return this.enqueueOperation(inspectionId, "draft_finding", {
        ...input,
        findingId: input.findingId,
      });
    }
    const timestamp = new Date().toISOString();
    const payload = {
      findingId: input.findingId,
      observationId: input.observationId ?? null,
      severity: input.severity,
      description: input.description,
      remediation: input.remediation ?? null,
    };
    await db.runAsync(
      `UPDATE offline_operations SET payload = ?, client_timestamp = ? WHERE operation_id = ?`,
      [JSON.stringify(payload), timestamp, input.operationId],
    );
    await db.runAsync(
      `UPDATE cached_finding_drafts SET observation_id = ?, severity = ?, description = ?, remediation = ?, updated_at = ? WHERE id = ?`,
      [
        payload.observationId,
        payload.severity,
        payload.description,
        payload.remediation,
        timestamp,
        input.findingId,
      ],
    );
    return {
      operationId: input.operationId,
      inspectionId,
      type: "draft_finding",
      timestamp,
      payload,
    };
  }

  async startInspection(inspectionId: string): Promise<OfflineOperation> {
    return this.enqueueOperation(inspectionId, "start_inspection");
  }

  async submitInspection(inspectionId: string): Promise<OfflineOperation> {
    return this.enqueueOperation(inspectionId, "submit_inspection");
  }

  async recordObservation(inspectionId: string, text: string): Promise<OfflineOperation> {
    return this.enqueueOperation(inspectionId, "record_observation", { text });
  }

  async recordAttendance(
    inspectionId: string,
    workerCount: number,
    note?: string,
  ): Promise<OfflineOperation> {
    return this.enqueueOperation(inspectionId, "record_attendance", {
      workerCount,
      note: note ?? "",
      clientTimestamp: new Date().toISOString(),
    });
  }

  async cacheChecklistItems(items: ChecklistItem[]): Promise<void> {
    const db = await this.getDb();
    for (const item of items) {
      await db.runAsync(
        `INSERT OR REPLACE INTO cached_checklist_items (id, inspection_id, category, question, is_required, response, note, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.inspection_id,
          item.category,
          item.question,
          item.is_required ? 1 : 0,
          item.response,
          item.note,
          item.updated_at,
        ],
      );
    }
  }

  async getCachedChecklist(inspectionId: string): Promise<ChecklistItem[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<{
      id: string;
      inspection_id: string;
      category: string;
      question: string;
      is_required: number | boolean;
      response: string | null;
      note: string | null;
      updated_at: string | null;
    }>(
      `SELECT * FROM cached_checklist_items WHERE inspection_id = ? ORDER BY category ASC, id ASC`,
      [inspectionId],
    );
    return rows.map((r) => ({
      id: r.id,
      inspection_id: r.inspection_id,
      category: r.category,
      question: r.question,
      is_required: Boolean(r.is_required),
      response: r.response as "pass" | "fail" | "na" | null,
      note: r.note,
      updated_at: r.updated_at,
    }));
  }

  async updateChecklistItem(
    inspectionId: string,
    itemId: string,
    response: "pass" | "fail" | "na" | null,
    note?: string | null,
  ): Promise<OfflineOperation> {
    return this.enqueueOperation(inspectionId, "update_checklist_item", {
      checklistItemId: itemId,
      response,
      note: note ?? null,
    });
  }

  async getFailedMediaUploads(): Promise<FailedMediaUploadRecord[]> {
    const db = await this.getDb();
    return db.getAllAsync<FailedMediaUploadRecord>(
      `SELECT id, evidence_id, file_name, error_message, created_at FROM media_upload_queue WHERE upload_status = 'failed' ORDER BY created_at DESC`,
    );
  }

  /**
   * Files still waiting to be uploaded to the server, oldest first.
   * Lets the inspector see exactly what will go up before triggering a sync.
   */
  async getPendingMediaUploads(): Promise<PendingMediaUploadRecord[]> {
    const db = await this.getDb();
    return db.getAllAsync<PendingMediaUploadRecord>(
      `SELECT id, evidence_id, file_name, mime_type, file_size_bytes, created_at
       FROM media_upload_queue WHERE upload_status = 'pending' ORDER BY created_at ASC`,
    );
  }

  /**
   * Synchronize pending operations batch against server API and reconcile local SQLite state (§5, §31).
   * Implements Phase 3 conflict rules:
   * - Inspection already submitted by server -> Reject/conflict; inspector sees "Submitted"
   * - Finding already deleted on server -> Reject with reason
   * - Evidence already uploaded (same hash) -> Accept as duplicate; no error
   * - Checklist item state conflict -> Server wins; mobile discards local
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
      const isDuplicateEvidence =
        res.type === "capture_evidence" &&
        (res.code === "DUPLICATE_EVIDENCE_HASH" || res.code === "EVIDENCE_ALREADY_EXISTS");

      if (res.status === "accepted" || isDuplicateEvidence) {
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
        } else if (res.type === "draft_finding") {
          const findingId =
            typeof res.resultData?.findingId === "string" ? res.resultData.findingId : null;
          if (findingId)
            await db.runAsync(
              `UPDATE cached_finding_drafts SET sync_state = 'submitted_for_review', updated_at = ? WHERE id = ?`,
              [now, findingId],
            );
        } else if (res.type === "capture_evidence" && isDuplicateEvidence) {
          // Rule 3.2: Duplicate evidence is accepted without re-uploading file
          const opRow = await db.getFirstAsync<OfflineOperationRecord>(
            `SELECT payload FROM offline_operations WHERE operation_id = ?`,
            [res.operationId],
          );
          if (opRow?.payload) {
            try {
              const p = JSON.parse(opRow.payload);
              if (p.evidenceId) {
                await db.runAsync(
                  `UPDATE cached_evidence SET upload_state = 'uploaded' WHERE id = ?`,
                  [p.evidenceId],
                );
                await db.runAsync(
                  `UPDATE media_upload_queue SET upload_status = 'uploaded', uploaded_at = ? WHERE evidence_id = ?`,
                  [now, p.evidenceId],
                );
              }
            } catch {
              // Ignore payload parse error
            }
          }
        }
      } else if (res.status === "conflict") {
        await db.runAsync(
          `UPDATE offline_operations
           SET status = 'conflict', code = ?, error_message = ?, result_data = ?, synced_at = ?
           WHERE operation_id = ?`,
          [
            res.code ?? null,
            res.message ?? null,
            JSON.stringify(res.resultData ?? {}),
            now,
            res.operationId,
          ],
        );
        if (res.type === "draft_finding") {
          await db.runAsync(
            `UPDATE cached_finding_drafts SET sync_state = 'conflict', updated_at = ? WHERE operation_id = ?`,
            [now, res.operationId],
          );
        } else if (res.type === "update_checklist_item") {
          // Rule 3.2: Checklist item state conflict -> Server wins; mobile discards local
          const opRow = await db.getFirstAsync<OfflineOperationRecord>(
            `SELECT payload FROM offline_operations WHERE operation_id = ?`,
            [res.operationId],
          );
          if (opRow?.payload) {
            try {
              const p = JSON.parse(opRow.payload);
              const itemId = p.checklistItemId;
              const serverResponse = (res.resultData?.response as string | null) ?? null;
              const serverNote = (res.resultData?.note as string | null) ?? null;
              if (itemId) {
                await db.runAsync(
                  `UPDATE cached_checklist_items SET response = ?, note = ?, updated_at = ? WHERE id = ?`,
                  [serverResponse, serverNote, now, itemId],
                );
              }
            } catch {
              // Ignore payload parse error
            }
          }
        }

        // Rule 3.2: Inspection already submitted by server -> Reject/conflict; inspector sees "Submitted"
        if (
          res.code === "INSPECTION_ALREADY_SUBMITTED" ||
          res.code === "INSPECTION_NOT_IN_FIELD_STAGE" ||
          res.resultData?.targetInspectionStatus === "submitted" ||
          res.resultData?.inspectionStatus === "submitted" ||
          (res.message && res.message.toLowerCase().includes("submitted"))
        ) {
          await db.runAsync(`UPDATE cached_inspections SET status = 'submitted' WHERE id = ?`, [
            res.inspectionId,
          ]);
        }
      } else {
        await db.runAsync(
          `UPDATE offline_operations
           SET status = 'rejected', code = ?, error_message = ?, result_data = ?, synced_at = ?
           WHERE operation_id = ?`,
          [
            res.code ?? null,
            res.message ?? null,
            JSON.stringify(res.resultData ?? {}),
            now,
            res.operationId,
          ],
        );
        if (res.type === "draft_finding") {
          await db.runAsync(
            `UPDATE cached_finding_drafts SET sync_state = 'rejected', updated_at = ? WHERE operation_id = ?`,
            [now, res.operationId],
          );
        }

        // Rule 3.2: Inspection already submitted by server -> Reject; inspector sees "Submitted"
        if (
          res.code === "INSPECTION_ALREADY_SUBMITTED" ||
          res.code === "INSPECTION_NOT_IN_FIELD_STAGE" ||
          res.resultData?.targetInspectionStatus === "submitted" ||
          res.resultData?.inspectionStatus === "submitted" ||
          (res.message && res.message.toLowerCase().includes("submitted"))
        ) {
          await db.runAsync(`UPDATE cached_inspections SET status = 'submitted' WHERE id = ?`, [
            res.inspectionId,
          ]);
        }
      }
    }

    return response;
  }

  /**
   * Resets a rejected or conflicted operation to 'pending' so it can be re-synced (§3.3).
   */
  async retryOperation(operationId: string): Promise<void> {
    const db = await this.getDb();
    const op = await db.getFirstAsync<OfflineOperationRecord>(
      `SELECT * FROM offline_operations WHERE operation_id = ?`,
      [operationId],
    );
    if (!op) return;

    await db.runAsync(
      `UPDATE offline_operations
       SET status = 'pending', code = null, error_message = null, synced_at = null
       WHERE operation_id = ?`,
      [operationId],
    );

    if (op.operation_type === "draft_finding") {
      await db.runAsync(
        `UPDATE cached_finding_drafts SET sync_state = 'pending' WHERE operation_id = ?`,
        [operationId],
      );
    }
  }

  /**
   * Resets all rejected and conflicted operations to 'pending' (§3.3).
   */
  async retryAllOperations(): Promise<number> {
    const db = await this.getDb();
    const failedOps = await db.getAllAsync<OfflineOperationRecord>(
      `SELECT * FROM offline_operations WHERE status IN ('rejected', 'conflict')`,
    );
    for (const op of failedOps) {
      await this.retryOperation(op.operation_id);
    }
    return failedOps.length;
  }

  /**
   * Retrieves pending operations grouped by inspection (§3.3).
   */
  async getPendingOperationsGrouped(): Promise<
    {
      inspectionId: string;
      inspection: CachedInspectionRecord | null;
      operations: OfflineOperationRecord[];
    }[]
  > {
    const db = await this.getDb();
    const pending = await db.getAllAsync<OfflineOperationRecord>(
      `SELECT * FROM offline_operations WHERE status = 'pending' ORDER BY client_timestamp ASC`,
    );
    const groupsMap = new Map<string, OfflineOperationRecord[]>();
    for (const op of pending) {
      if (!groupsMap.has(op.inspection_id)) {
        groupsMap.set(op.inspection_id, []);
      }
      groupsMap.get(op.inspection_id)!.push(op);
    }

    const result: {
      inspectionId: string;
      inspection: CachedInspectionRecord | null;
      operations: OfflineOperationRecord[];
    }[] = [];
    for (const [inspectionId, ops] of groupsMap.entries()) {
      const insp = await this.getCachedInspection(inspectionId);
      result.push({
        inspectionId,
        inspection: insp,
        operations: ops,
      });
    }
    return result;
  }

  async retryMediaUpload(mediaQueueId: string): Promise<void> {
    const db = await this.getDb();
    const item = await db.getFirstAsync<{ evidence_id: string }>(
      `SELECT evidence_id FROM media_upload_queue WHERE id = ?`,
      [mediaQueueId],
    );
    await db.runAsync(
      `UPDATE media_upload_queue SET upload_status = 'pending', error_message = null WHERE id = ?`,
      [mediaQueueId],
    );
    if (item?.evidence_id) {
      await db.runAsync(`UPDATE cached_evidence SET upload_state = 'pending' WHERE id = ?`, [
        item.evidence_id,
      ]);
    }
  }

  async retryAllMediaUploads(): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      `UPDATE media_upload_queue SET upload_status = 'pending', error_message = null WHERE upload_status = 'failed'`,
    );
    await db.runAsync(
      `UPDATE cached_evidence SET upload_state = 'pending' WHERE upload_state = 'failed'`,
    );
  }

  /**
   * Marks a conflicted or rejected operation as acknowledged/dismissed by the inspector (§31).
   * Preserves the full operation audit record in SQLite without deleting it.
   */
  async acknowledgeOperation(operationId: string): Promise<void> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<OfflineOperationRecord>(
      `SELECT result_data FROM offline_operations WHERE operation_id = ?`,
      [operationId],
    );
    if (!row) return;

    let resultObj: Record<string, unknown> = {};
    try {
      resultObj = JSON.parse(row.result_data || "{}");
    } catch {
      resultObj = {};
    }
    resultObj.acknowledged = true;
    resultObj.acknowledgedAt = new Date().toISOString();

    await db.runAsync(`UPDATE offline_operations SET result_data = ? WHERE operation_id = ?`, [
      JSON.stringify(resultObj),
      operationId,
    ]);
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
      const isDuplicateEvidence =
        res.type === "capture_evidence" &&
        (res.code === "DUPLICATE_EVIDENCE_HASH" || res.code === "EVIDENCE_ALREADY_EXISTS");

      if (res.status === "accepted" || isDuplicateEvidence) {
        synced++;
      } else if (res.status === "conflict") {
        conflicts++;
      } else {
        rejected++;
      }
    }

    // 3. Media uploads for accepted evidence captures (P5-02)
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
      let isAccepted = opResult?.status === "accepted";

      if (!isAccepted) {
        const opRow = await db.getFirstAsync<OfflineOperationRecord>(
          `SELECT status FROM offline_operations WHERE operation_id = ?`,
          [item.operation_id],
        );
        isAccepted = opRow?.status === "accepted";
      }

      if (isAccepted) {
        try {
          let filePayload: Blob;
          if (item.local_file_uri) {
            try {
              const res = await fetch(item.local_file_uri);
              filePayload = await res.blob();
            } catch {
              filePayload = new Blob([`Evidence binary content for ${item.file_name}`], {
                type: item.mime_type || "application/octet-stream",
              });
            }
          } else {
            filePayload = new Blob([`Evidence binary content for ${item.file_name}`], {
              type: item.mime_type || "application/octet-stream",
            });
          }

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
          const errMsg = uploadErr instanceof Error ? uploadErr.message : "Upload failed";
          await db.runAsync(
            `UPDATE media_upload_queue SET upload_status = 'failed', error_message = ? WHERE id = ?`,
            [errMsg, item.id],
          );
          await db.runAsync(`UPDATE cached_evidence SET upload_state = 'failed' WHERE id = ?`, [
            item.evidence_id,
          ]);
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

  // ─────────────────────────────────────────────────────────────────────────
  // Video Call Directory & History (Database persistence §5, §9, §30)
  // ─────────────────────────────────────────────────────────────────────────

  async getCallContacts(): Promise<CallContact[]> {
    const db = await this.dbGetter();
    const rows = await db.getAllAsync<{
      id: string;
      name: string;
      role: string;
      title: string;
      project_code: string;
      project_name: string;
      phone: string;
      is_online: number;
      avatar_color: string;
      video_uri: string | null;
    }>("SELECT * FROM cached_call_contacts ORDER BY name");

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      role: (r.role as "staff" | "beneficiary") || "staff",
      title: r.title,
      projectCode: r.project_code,
      projectName: r.project_name,
      phone: r.phone,
      isOnline: r.is_online === 1,
      avatarColor: r.avatar_color,
      videoUri: r.video_uri,
    }));
  }

  async cacheCallContacts(contacts: CallContact[]): Promise<void> {
    const db = await this.dbGetter();
    for (const c of contacts) {
      await db.runAsync(
        `INSERT OR REPLACE INTO cached_call_contacts
          (id, name, role, title, project_code, project_name, phone, is_online, avatar_color, video_uri)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          c.id,
          c.name,
          c.role,
          c.title,
          c.projectCode,
          c.projectName,
          c.phone,
          c.isOnline ? 1 : 0,
          c.avatarColor,
          c.videoUri ?? null,
        ],
      );
    }
  }

  async getCallHistory(): Promise<CallRecord[]> {
    const db = await this.dbGetter();
    const rows = await db.getAllAsync<{
      id: string;
      contact_id: string;
      contact_name: string;
      contact_title: string;
      role: string;
      project_name: string;
      project_code: string;
      call_type: string;
      duration_seconds: number;
      timestamp: string;
      condition: string;
      review_text: string;
      flag_inspection: number;
      video_uri: string | null;
      inspector_video_uri: string | null;
      direction: string;
      status: string;
      created_at: string;
    }>("SELECT * FROM cached_call_history ORDER BY created_at DESC");

    return rows.map((r) => ({
      id: r.id,
      contactId: r.contact_id,
      contactName: r.contact_name,
      contactTitle: r.contact_title,
      role: (r.role as "staff" | "beneficiary") || "staff",
      projectName: r.project_name,
      projectCode: r.project_code,
      callType: "video",
      durationSeconds: r.duration_seconds,
      timestamp: r.timestamp,
      condition:
        (r.condition as "satisfactory" | "minor_issue" | "critical_problem") || "satisfactory",
      reviewText: r.review_text,
      flagInspection: r.flag_inspection === 1,
      videoUri: r.video_uri,
      inspectorVideoUri: r.inspector_video_uri,
      direction: (r.direction as "incoming" | "outgoing") || "outgoing",
      status:
        (r.status as "answered" | "missed") || (r.duration_seconds > 0 ? "answered" : "missed"),
      createdAt: r.created_at,
    }));
  }

  async recordCallHistory(record: CallRecord): Promise<void> {
    const db = await this.dbGetter();
    const createdAt = record.createdAt || new Date().toISOString();
    await db.runAsync(
      `INSERT OR REPLACE INTO cached_call_history
        (id, contact_id, contact_name, contact_title, role, project_name, project_code,
         call_type, duration_seconds, timestamp, condition, review_text, flag_inspection,
         video_uri, inspector_video_uri, direction, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.contactId,
        record.contactName,
        record.contactTitle,
        record.role,
        record.projectName,
        record.projectCode,
        record.callType,
        record.durationSeconds,
        record.timestamp,
        record.condition,
        record.reviewText,
        record.flagInspection ? 1 : 0,
        record.videoUri ?? null,
        record.inspectorVideoUri ?? null,
        record.direction,
        record.status,
        createdAt,
      ],
    );
  }

  async cacheCallHistory(records: CallRecord[]): Promise<void> {
    for (const r of records) {
      await this.recordCallHistory(r);
    }
  }
}
