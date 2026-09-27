import { z } from "zod";
import {
  CORRECTIVE_ACTION_REVIEW_OUTCOMES,
  CORRECTIVE_ACTION_STATUSES,
} from "@netram/types";
import { FINDING_SEVERITIES } from "@netram/types";
import { paginationSchema, uuidSchema } from "./common.js";

export const correctiveActionFileSchema = z.object({
  id: z.string().uuid(),
  correctiveActionId: z.string().uuid(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  contentHash: z.string(),
  createdAt: z.string().datetime(),
});

export const correctiveActionSchema = z.object({
  id: z.string().uuid(),
  findingId: z.string().uuid(),
  inspectionId: z.string().uuid(),
  organisationId: z.string().uuid().nullable(),
  status: z.enum(CORRECTIVE_ACTION_STATUSES),
  deadline: z.string().datetime().nullable(),
  submittedAt: z.string().datetime().nullable(),
  actionSummary: z.string().nullable(),
  atrFiles: z.array(correctiveActionFileSchema),
  verifiedAt: z.string().datetime().nullable(),
  verifiedByUserId: z.string().uuid().nullable(),
  reviewRemarks: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  project: z
    .object({
      id: z.string().uuid(),
      code: z.string(),
      name: z.string(),
      districtId: z.string().uuid().nullable(),
      districtName: z.string().max(200).nullable(),
      stateName: z.string().max(200).nullable(),
      description: z.string().nullable(),
    })
    .nullable(),
  finding: z
    .object({
      id: z.string().uuid(),
      severity: z.enum(FINDING_SEVERITIES),
      description: z.string(),
      categoryId: z.string().uuid().nullable(),
      categoryName: z.string().nullable(),
    })
    .nullable(),
});

export const correctiveActionPageSchema = z.object({
  items: z.array(correctiveActionSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export const createCorrectiveActionSchema = z
  .object({
    findingId: uuidSchema,
    organisationId: uuidSchema.nullable().optional(),
    deadline: z.string().datetime().nullable().optional(),
  })
  .strict();

/**
 * Institution lodges the Action Taken Report (docs/DoSJE.md §16). Recording
 * this evidence is what advances the order to `submitted` — no manual status
 * toggle exists.
 */
export const submitAtrSchema = z
  .object({
    actionSummary: z.string().min(1).max(4000),
  })
  .strict();

/**
 * Authority records its review decision (`under_review` engagement, or the
 * terminal accept/reject verdict). The status follows from this recorded work.
 */
export const reviewCorrectiveActionSchema = z
  .object({
    outcome: z.enum(CORRECTIVE_ACTION_REVIEW_OUTCOMES),
    note: z.string().max(500).optional(),
  })
  .strict();

export const correctiveActionListQuerySchema = paginationSchema.extend({
  findingId: uuidSchema.optional(),
  inspectionId: uuidSchema.optional(),
  status: z.enum(CORRECTIVE_ACTION_STATUSES).optional(),
  organisationId: uuidSchema.optional(),
});
