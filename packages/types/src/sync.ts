import type { UUID, ISODateTime } from "./common.js";

/**
 * Types of operations an assigned inspector can perform in the field while offline.
 * Must be operation-based (§5, §31), not simple key-value state overwrites.
 */
export const OFFLINE_OPERATION_TYPES = [
  "draft_finding",
  "start_inspection",
  "record_observation",
  "capture_evidence",
  "submit_inspection",
] as const;

export type OfflineOperationType = (typeof OFFLINE_OPERATION_TYPES)[number];

/**
 * Status of an operation in the sync reconciliation lifecycle.
 */
export const OFFLINE_OPERATION_STATUSES = ["pending", "accepted", "rejected", "conflict"] as const;

export type OfflineOperationStatus = (typeof OFFLINE_OPERATION_STATUSES)[number];

/**
 * An immutable operation record generated client-side with a unique UUID.
 */
export interface OfflineOperation<T = Record<string, unknown>> {
  operationId: UUID;
  inspectionId: UUID;
  type: OfflineOperationType;
  timestamp: ISODateTime;
  payload: T;
}

/**
 * Server evaluation and reconciliation result for a single operation.
 */
export interface SyncOperationResult {
  operationId: UUID;
  inspectionId: UUID;
  type: OfflineOperationType;
  status: OfflineOperationStatus;
  code?: string;
  message?: string;
  resultData?: Record<string, unknown>;
  syncedAt: ISODateTime;
}

/**
 * Batch synchronization request from client.
 */
export interface SyncBatchRequest {
  operations: OfflineOperation[];
}

/**
 * Batch synchronization response from server.
 */
export interface SyncBatchResponse {
  results: SyncOperationResult[];
  processedAt: ISODateTime;
}
