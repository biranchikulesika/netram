import { z } from "zod";
import { FINDING_SEVERITIES, FINDING_STATUSES, FINDING_TRANSITIONS } from "@netram/types";
import { uuidSchema } from "./common.js";

export const findingSchema = z.object({
  id: z.string().uuid(),
  inspectionId: z.string().uuid(),
  observationId: z.string().uuid().nullable(),
  severity: z.enum(FINDING_SEVERITIES),
  description: z.string(),
  remediation: z.string().nullable(),
  status: z.enum(FINDING_STATUSES),
  categoryId: z.string().uuid().nullable(),
  amountInr: z.number().int().nullable(),
  responsibleOrganisationId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const findingListSchema = z.array(findingSchema);

export const createFindingSchema = z
  .object({
    severity: z.enum(FINDING_SEVERITIES),
    description: z.string().min(1).max(4000),
    remediation: z.string().max(4000).optional(),
    observationId: uuidSchema.nullable().optional(),
    /** Issue category (docs/DoSJE.md §15). */
    categoryId: uuidSchema.nullable().optional(),
    /** Disputed/misappropriated amount in INR for financial issues. */
    amountInr: z.number().int().min(0).max(2_000_000_000).nullable().optional(),
    /** Organisation expected to answer the issue (ATR submitter). */
    responsibleOrganisationId: uuidSchema.nullable().optional(),
  })
  .strict();

export const transitionFindingSchema = z
  .object({
    to: z.enum(FINDING_STATUSES),
    note: z.string().max(500).optional(),
  })
  .strict();

export function isAllowedFindingTransition(
  from: (typeof FINDING_STATUSES)[number],
  to: (typeof FINDING_STATUSES)[number],
): boolean {
  return FINDING_TRANSITIONS[from].includes(to);
}
