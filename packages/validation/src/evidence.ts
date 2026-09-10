import { z } from "zod";
import { EVIDENCE_INTEGRITY_STATES, EVIDENCE_TYPES, EVIDENCE_UPLOAD_STATES } from "@netram/types";
import { uuidSchema } from "./common.js";

const sha256Hash = z
  .string()
  .regex(/^sha256:[0-9a-f]{64}$/, "contentHash must be sha256:<64 lowercase hex chars>");

export const evidenceSchema = z.object({
  id: z.string().uuid(),
  inspectionId: z.string().uuid(),
  findingId: z.string().uuid().nullable(),
  capturedAt: z.string().datetime(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  evidenceType: z.enum(EVIDENCE_TYPES),
  fileName: z.string().nullable(),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  contentHash: sha256Hash.nullable(),
  storageKey: z.string().max(300).nullable(),
  deviceId: z.string().nullable(),
  uploadState: z.enum(EVIDENCE_UPLOAD_STATES),
  integrityState: z.enum(EVIDENCE_INTEGRITY_STATES),
  createdAt: z.string().datetime(),
});

export const evidenceListSchema = z.array(evidenceSchema);

export const captureEvidenceSchema = z
  .object({
    capturedAt: z.string().datetime(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    evidenceType: z.enum(EVIDENCE_TYPES),
    fileName: z.string().max(300).optional(),
    mimeType: z.string().max(100).optional(),
    sizeBytes: z.number().int().nonnegative().optional(),
    contentHash: sha256Hash.nullable().optional(),
    deviceId: z.string().max(100).optional(),
    findingId: uuidSchema.nullable().optional(),
  })
  .strict();

export const verifyEvidenceIntegritySchema = z
  .object({
    contentHash: sha256Hash,
  })
  .strict();
