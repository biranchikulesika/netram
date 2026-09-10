import { z } from "zod";
import { ANOMALY_SEVERITIES, ANOMALY_STATUSES, ANOMALY_TYPES } from "@netram/types";
import { paginationSchema, uuidSchema } from "./common.js";

export const aiAnomalySchema = z.object({
  id: z.string().uuid(),
  inspectionId: z.string().uuid(),
  evidenceId: z.string().uuid().nullable(),
  type: z.enum(ANOMALY_TYPES),
  severity: z.enum(ANOMALY_SEVERITIES),
  confidence: z.number().min(0).max(1),
  modelVersion: z.string().max(50).nullable(),
  explanation: z.string().max(4000).nullable(),
  status: z.enum(ANOMALY_STATUSES),
  reviewedBy: z.string().uuid().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  projectCode: z.string().max(50).nullable(),
  projectName: z.string().max(300).nullable(),
  districtId: z.string().uuid().nullable(),
});

export const aiAnomalyPageSchema = z.object({
  items: z.array(aiAnomalySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export const aiAnomalyListQuerySchema = paginationSchema.extend({
  type: z.enum(ANOMALY_TYPES).optional(),
  severity: z.enum(ANOMALY_SEVERITIES).optional(),
  status: z.enum(ANOMALY_STATUSES).optional(),
  inspectionId: uuidSchema.optional(),
});

export const transitionAiAnomalySchema = z
  .object({
    to: z.enum(ANOMALY_STATUSES),
  })
  .strict();
