import type { UUID, ISODateTime } from "./common.js";

export const EVIDENCE_TYPES = ["photo", "video", "audio", "document", "other"] as const;

export const EVIDENCE_UPLOAD_STATES = ["pending", "uploaded", "failed"] as const;

export const EVIDENCE_INTEGRITY_STATES = ["unknown", "verified", "mismatch"] as const;

/** Upload lifecycle: capture records metadata (pending); upload completes it. */
export const EVIDENCE_UPLOAD_TRANSITIONS: Record<
  (typeof EVIDENCE_UPLOAD_STATES)[number],
  readonly (typeof EVIDENCE_UPLOAD_STATES)[number][]
> = {
  pending: ["uploaded"],
  failed: ["uploaded"],
  uploaded: [],
};

/** Integrity verification is repeatable: later server-side re-checks may unmask corruption. */
export const EVIDENCE_INTEGRITY_TRANSITIONS: Record<
  (typeof EVIDENCE_INTEGRITY_STATES)[number],
  readonly (typeof EVIDENCE_INTEGRITY_STATES)[number][]
> = {
  unknown: ["verified", "mismatch"],
  mismatch: ["verified"],
  verified: ["mismatch"],
};

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];
export type EvidenceUploadState = (typeof EVIDENCE_UPLOAD_STATES)[number];
export type EvidenceIntegrityState = (typeof EVIDENCE_INTEGRITY_STATES)[number];

/**
 * Evidence is authoritative operational data (§30). Deserialized from the
 * database for the API contract; the large media lives in object storage and
 * only this metadata plus the capture-time content hash are authoritative.
 */
export interface Evidence {
  id: UUID;
  inspectionId: UUID;
  findingId: UUID | null;
  capturedAt: ISODateTime;
  latitude: number | null;
  longitude: number | null;
  evidenceType: EvidenceType;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  contentHash: string | null;
  storageKey: string | null;
  deviceId: string | null;
  uploadState: EvidenceUploadState;
  integrityState: EvidenceIntegrityState;
  createdAt: ISODateTime;
}
