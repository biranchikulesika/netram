import { z } from "zod";
import {
  INSPECTION_STATUSES,
  INSPECTION_TYPES,
  INSPECTION_TRIGGERS,
  INSPECTION_TRANSITIONS,
} from "@netram/types";
import { paginationSchema, uuidSchema } from "./common.js";

export const inspectionSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  projectCode: z.string(),
  projectName: z.string(),
  districtId: z.string().uuid().nullable(),
  districtName: z.string().max(200).nullable(),
  templateId: z.string().uuid().nullable(),
  type: z.enum(INSPECTION_TYPES),
  trigger: z.enum(INSPECTION_TRIGGERS),
  status: z.enum(INSPECTION_STATUSES),
  disclosurePolicyId: z.string().uuid().nullable(),
  disclosureRuleType: z.string().nullable(),
  scheduledStart: z.string().datetime().nullable(),
  scheduledEnd: z.string().datetime().nullable(),
  startedAt: z.string().datetime().nullable(),
  submittedAt: z.string().datetime().nullable(),
  assignedUserIds: z.array(z.string().uuid()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const inspectionPageSchema = z.object({
  items: z.array(inspectionSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export const createInspectionSchema = z
  .object({
    projectId: uuidSchema,
    type: z.enum(INSPECTION_TYPES),
    trigger: z.enum(INSPECTION_TRIGGERS).default("officer"),
    templateId: uuidSchema.nullable().optional(),
    disclosurePolicyId: uuidSchema.nullable().optional(),
    scheduledStart: z.string().datetime().nullable().optional(),
    scheduledEnd: z.string().datetime().nullable().optional(),
    assigneeUserIds: z.array(uuidSchema).max(20).optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.scheduledStart === null ||
      v.scheduledStart === undefined ||
      v.scheduledEnd === null ||
      v.scheduledEnd === undefined ||
      v.scheduledStart < v.scheduledEnd,
    {
      message: "scheduledStart must be before scheduledEnd",
      path: ["scheduledEnd"],
    },
  );

export const transitionInspectionSchema = z
  .object({
    to: z.enum(INSPECTION_STATUSES),
    note: z.string().max(500).optional(),
  })
  .strict();

export const inspectionListQuerySchema = paginationSchema.extend({
  status: z.enum(INSPECTION_STATUSES).optional(),
  type: z.enum(INSPECTION_TYPES).optional(),
  projectId: uuidSchema.optional(),
});

/** Runtime re-statement of the domain transition table for validation at the boundary. */
export function isAllowedInspectionTransition(
  from: (typeof INSPECTION_STATUSES)[number],
  to: (typeof INSPECTION_STATUSES)[number],
): boolean {
  return INSPECTION_TRANSITIONS[from].includes(to);
}
