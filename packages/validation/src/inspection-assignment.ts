import { z } from "zod";
import { ASSIGNMENT_ROLES } from "@netram/types";
import { paginationSchema, uuidSchema } from "./common.js";

export const inspectionAssignmentSchema = z.object({
  id: z.string().uuid(),
  inspectionId: z.string().uuid(),
  userId: z.string().uuid(),
  userName: z.string().max(200).nullable(),
  role: z.enum(ASSIGNMENT_ROLES),
  assignedAt: z.string().datetime(),
  inspectionStatus: z.string().max(30).nullable(),
  inspectionType: z.string().max(50).nullable(),
  projectCode: z.string().max(50).nullable(),
  projectName: z.string().max(300).nullable(),
  districtId: z.string().uuid().nullable(),
});

export const assignmentPageSchema = z.object({
  items: z.array(inspectionAssignmentSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export const assignmentListQuerySchema = paginationSchema;

export const createAssignmentSchema = z
  .object({
    userId: uuidSchema,
    role: z.enum(ASSIGNMENT_ROLES).default("member"),
  })
  .strict();
