import { z } from "zod";
import { COMPLAINT_STATUSES, COMPLAINT_TRANSITIONS } from "@netram/types";
import { paginationSchema, uuidSchema } from "./common.js";

export const complaintSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  projectCode: z.string(),
  projectName: z.string(),
  districtId: z.string().uuid().nullable(),
  complainantName: z.string().nullable(),
  contactInfo: z.string().nullable(),
  trackingCode: z.string(),
  description: z.string(),
  status: z.enum(COMPLAINT_STATUSES),
  receivedAt: z.string().datetime(),
  resolutionText: z.string().nullable(),
  resolvedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const complaintPageSchema = z.object({
  items: z.array(complaintSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});

export const complaintListQuerySchema = paginationSchema.extend({
  status: z.enum(COMPLAINT_STATUSES).optional(),
  projectId: uuidSchema.optional(),
});

export const createComplaintSchema = z
  .object({
    projectId: uuidSchema,
    description: z.string().min(10).max(8000),
    complainantName: z.string().max(200).optional(),
    contactInfo: z.string().max(300).optional(),
  })
  .strict();

export const transitionComplaintSchema = z
  .object({
    to: z.enum(COMPLAINT_STATUSES),
    resolutionText: z.string().max(4000).optional(),
  })
  .strict();

export const publicComplaintTrackingSchema = z.object({
  trackingCode: z.string(),
  projectCode: z.string(),
  projectName: z.string(),
  status: z.enum(COMPLAINT_STATUSES),
  receivedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  resolutionText: z.string().nullable(),
});

export function isAllowedComplaintTransition(
  from: (typeof COMPLAINT_STATUSES)[number],
  to: (typeof COMPLAINT_STATUSES)[number],
): boolean {
  return COMPLAINT_TRANSITIONS[from].includes(to);
}
