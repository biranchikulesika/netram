import { z } from "zod";
import { CORRECTIVE_ACTION_STATUSES, CORRECTIVE_ACTION_TRANSITIONS } from "@netram/types";
import { paginationSchema, uuidSchema } from "./common.js";

export const correctiveActionSchema = z.object({
  id: z.string().uuid(),
  findingId: z.string().uuid(),
  inspectionId: z.string().uuid(),
  organisationId: z.string().uuid().nullable(),
  status: z.enum(CORRECTIVE_ACTION_STATUSES),
  deadline: z.string().datetime().nullable(),
  submittedAt: z.string().datetime().nullable(),
  actionSummary: z.string().nullable(),
  atrCode: z.string().nullable(),
  verifiedAt: z.string().datetime().nullable(),
  verifiedByUserId: z.string().uuid().nullable(),
  reviewRemarks: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
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

export const transitionCorrectiveActionSchema = z
  .object({
    to: z.enum(CORRECTIVE_ACTION_STATUSES),
    note: z.string().max(500).optional(),
    /** ATR content supplied with the institution's submit step (docs/DoSJE.md §16). */
    actionSummary: z.string().min(1).max(4000).optional(),
    atrCode: z.string().max(50).optional(),
  })
  .strict();

export const correctiveActionListQuerySchema = paginationSchema.extend({
  findingId: uuidSchema.optional(),
  inspectionId: uuidSchema.optional(),
  status: z.enum(CORRECTIVE_ACTION_STATUSES).optional(),
  organisationId: uuidSchema.optional(),
});

export function isAllowedCorrectiveActionTransition(
  from: (typeof CORRECTIVE_ACTION_STATUSES)[number],
  to: (typeof CORRECTIVE_ACTION_STATUSES)[number],
): boolean {
  return CORRECTIVE_ACTION_TRANSITIONS[from].includes(to);
}
