import { z } from "zod";
import { uuidSchema } from "./common.js";

export const projectPhotoSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  uploadedBy: uuidSchema.nullable(),
  capturedAt: z.string().datetime(),
  caption: z.string().max(500).nullable(),
  fileName: z.string().max(300).nullable(),
  mimeType: z.string().max(100).nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  contentHash: z.string().max(128).nullable(),
  storageKey: z.string().max(300).nullable(),
  createdAt: z.string().datetime(),
});

export const projectPhotoListSchema = z.array(projectPhotoSchema);

export const uploadProjectPhotoSchema = z
  .object({
    capturedAt: z.string().datetime(),
    caption: z.string().max(500).optional(),
  })
  .strict();
