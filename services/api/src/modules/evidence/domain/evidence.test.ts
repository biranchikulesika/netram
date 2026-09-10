import { describe, expect, it } from "vitest";
import {
  decideIntegrityAfterUpload,
  evaluateEvidenceIntegrity,
  evaluateEvidenceUpload,
  InvalidEvidenceTransitionError,
} from "./evidence.js";

describe("evidence domain", () => {
  it("allows uploading pending or failed evidence", () => {
    expect(evaluateEvidenceUpload("pending", "uploaded").to).toBe("uploaded");
    expect(evaluateEvidenceUpload("failed", "uploaded").to).toBe("uploaded");
  });

  it("rejects uploading already-uploaded or from a terminal state", () => {
    expect(() => evaluateEvidenceUpload("uploaded", "uploaded")).toThrow(
      InvalidEvidenceTransitionError,
    );
    expect(() => evaluateEvidenceUpload("pending", "failed")).toThrow(
      InvalidEvidenceTransitionError,
    );
  });

  it("allows verifying already-uploaded evidence repeatedly, including reverting a verified state to mismatch", () => {
    expect(evaluateEvidenceIntegrity("unknown", "verified", true).to).toBe("verified");
    expect(evaluateEvidenceIntegrity("unknown", "mismatch", true).to).toBe("mismatch");
    expect(evaluateEvidenceIntegrity("mismatch", "verified", true).to).toBe("verified");
    expect(evaluateEvidenceIntegrity("verified", "mismatch", true).to).toBe("mismatch");
  });

  it("rejects integrity checks before upload and non-transitions", () => {
    expect(() => evaluateEvidenceIntegrity("unknown", "verified", false)).toThrow(
      InvalidEvidenceTransitionError,
    );
    expect(() => evaluateEvidenceIntegrity("verified", "verified", true)).toThrow(
      InvalidEvidenceTransitionError,
    );
  });

  it("verifies uploads whose bytes match the capture-time hash", () => {
    expect(decideIntegrityAfterUpload("abc123", "abc123")).toBe("verified");
  });

  it("flags mismatched bytes as integrity mismatch", () => {
    expect(decideIntegrityAfterUpload("abc123", "def456")).toBe("mismatch");
  });

  it("records the upload hash when no capture-time hash existed", () => {
    expect(decideIntegrityAfterUpload(null, "def456")).toBeNull();
  });
});
