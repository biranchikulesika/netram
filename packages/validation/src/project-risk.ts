import { z } from "zod";
import { uuidSchema, paginationSchema } from "./common.js";

export const compositeRiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);

export const projectRiskRankingQuerySchema = paginationSchema.extend({
  districtId: uuidSchema.optional(),
  programmeId: uuidSchema.optional(),
  organisationId: uuidSchema.optional(),
  riskLevel: compositeRiskLevelSchema.optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  maxScore: z.coerce.number().min(0).max(100).optional(),
});

export const projectRiskSnapshotQuerySchema = z.object({
  projectId: uuidSchema,
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
});

export const evaluateProjectRiskSchema = z.object({
  projectId: uuidSchema,
});
