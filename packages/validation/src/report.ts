import { z } from "zod";
import { REPORT_FORMATS, REPORT_STATUSES } from "@netram/types";
import { paginationSchema, uuidSchema } from "./common.js";

export const reportSchema = z.object({
  id: z.string().uuid(),
  inspectionId: z.string().uuid(),
  format: z.enum(REPORT_FORMATS),
  status: z.enum(REPORT_STATUSES),
  inspectionType: z.string().max(50),
  inspectionStatus: z.string().max(30),
  projectCode: z.string().max(50).nullable(),
  projectName: z.string().max(300).nullable(),
  districtId: z.string().uuid().nullable(),
  requestedBy: z.string().uuid().nullable(),
  requestedAt: z.string().datetime(),
  generatedBy: z.string().uuid().nullable(),
  generatedAt: z.string().datetime().nullable(),
  error: z.string().max(4000).nullable(),
  finalizedBy: z.string().uuid().nullable(),
  finalizedAt: z.string().datetime().nullable(),
  artifact: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const reportPageSchema = z.object({
  items: z.array(reportSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export const reportListQuerySchema = paginationSchema.extend({
  inspectionId: uuidSchema.optional(),
  status: z.enum(REPORT_STATUSES).optional(),
});

export const createReportSchema = z
  .object({
    inspectionId: uuidSchema,
    format: z.enum(REPORT_FORMATS).default("json"),
  })
  .strict();
