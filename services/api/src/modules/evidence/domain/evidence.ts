import type { EvidenceIntegrityState, EvidenceUploadState } from "@netram/types";
import { EVIDENCE_INTEGRITY_TRANSITIONS, EVIDENCE_UPLOAD_TRANSITIONS } from "@netram/types";

export class InvalidEvidenceTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidEvidenceTransitionError";
  }
}

export function evaluateEvidenceUpload(
  from: EvidenceUploadState,
  to: EvidenceUploadState,
): { to: EvidenceUploadState } {
  if (!EVIDENCE_UPLOAD_TRANSITIONS[from].includes(to)) {
    throw new InvalidEvidenceTransitionError(`Evidence upload cannot move from ${from} to ${to}.`);
  }
  return { to };
}

export function evaluateEvidenceIntegrity(
  from: EvidenceIntegrityState,
  to: EvidenceIntegrityState,
  isUploaded: boolean,
): { to: EvidenceIntegrityState } {
  if (!isUploaded) {
    throw new InvalidEvidenceTransitionError(
      "Evidence integrity can only be verified after the object is uploaded.",
    );
  }
  if (!EVIDENCE_INTEGRITY_TRANSITIONS[from].includes(to)) {
    throw new InvalidEvidenceTransitionError(
      `Evidence integrity cannot move from ${from} to ${to}.`,
    );
  }
  return { to };
}

/**
 * Decide the integrity outcome of a server-side upload against the
 * capture-time hash. Returns null when no capture-time hash was recorded
 * (nothing to compare against - the upload hash becomes authoritative instead).
 */
export function decideIntegrityAfterUpload(
  storedHash: string | null,
  computedHash: string,
): EvidenceIntegrityState | null {
  if (storedHash === null) return null;
  return storedHash === computedHash ? "verified" : "mismatch";
}
