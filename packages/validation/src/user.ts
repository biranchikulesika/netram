import { z } from "zod";
import { ASSIGNMENT_SCOPES, PERMISSIONS, USER_STATUSES } from "@netram/types";
import { paginationSchema, uuidSchema } from "./common.js";

export const roleAssignmentViewSchema = z.object({
  id: uuidSchema,
  roleCode: z.string().max(50),
  authorityId: uuidSchema.nullable(),
  jurisdictionId: uuidSchema.nullable(),
  scope: z.enum(ASSIGNMENT_SCOPES),
});

export const userAdminViewSchema = z.object({
  id: uuidSchema,
  email: z.string().email().max(255),
  displayName: z.string().max(200).nullable(),
  status: z.enum(USER_STATUSES),
  assignments: z.array(roleAssignmentViewSchema),
  createdAt: z.string().datetime(),
});

export const userListResponseSchema = z.object({
  items: z.array(userAdminViewSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export const userListQuerySchema = paginationSchema.extend({
  search: z.string().max(100).optional(),
});

export const roleViewSchema = z.object({
  id: uuidSchema,
  code: z.string().max(50),
  name: z.string().max(200),
  permissions: z.array(z.string().max(80)),
});

export const jurisdictionViewSchema = z.object({
  id: uuidSchema,
  code: z.string().max(50),
  name: z.string().max(300),
  scopeLevel: z.string().max(20),
});

export const updateUserSchema = z
  .object({
    displayName: z.string().max(200).optional(),
    status: z.enum(USER_STATUSES).optional(),
  })
  .strict()
  .refine((v) => v.displayName !== undefined || v.status !== undefined, {
    message: "At least one field to update is required.",
  });

export const assignRoleSchema = z
  .object({
    roleCode: z.string().max(50),
    authorityId: uuidSchema.optional(),
    jurisdictionId: uuidSchema.optional(),
    scope: z.enum(ASSIGNMENT_SCOPES),
  })
  .strict()
  .refine((v) => v.scope !== "jurisdiction" || v.jurisdictionId, {
    message: "jurisdictionId is required for jurisdiction scope.",
  });

export const updateRolePermissionsSchema = z
  .object({
    permissions: z
      .array(z.string().max(80))
      .min(1)
      .refine((all) => all.every((p) => (PERMISSIONS as readonly string[]).includes(p)), {
        message: "Unknown permission code.",
      }),
  })
  .strict();
