import { z } from "zod";
import { PROJECT_STATUSES, PROJECT_TYPES, PROJECT_TRANSITIONS } from "@netram/types";
import { paginationSchema, uuidSchema } from "./common.js";

export const geofenceTypeSchema = z.enum(["circle", "polygon"]);

export const projectGeofenceSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  type: geofenceTypeSchema,
  radiusMeters: z.number().int().nonnegative(),
  centerLat: z.number().nullable(),
  centerLng: z.number().nullable(),
  polygonVertices: z.array(z.tuple([z.number(), z.number()])),
  sealedById: z.string().uuid().nullable(),
  sealedAt: z.string().datetime(),
  auditTx: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const sealGeofenceSchema = z
  .object({
    type: geofenceTypeSchema,
    radiusMeters: z.number().int().min(10).max(50000).optional(),
    centerLat: z.number().min(-90).max(90).optional(),
    centerLng: z.number().min(-180).max(180).optional(),
    polygonVertices: z.array(z.tuple([z.number(), z.number()])).optional(),
  })
  .strict();

export const projectSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  type: z.enum(PROJECT_TYPES),
  description: z.string().nullable(),
  organisationId: z.string().uuid().nullable(),
  authorityId: z.string().uuid().nullable(),
  districtId: z.string().uuid().nullable(),
  status: z.enum(PROJECT_STATUSES),
  approvedById: z.string().uuid().nullable(),
  approvedAt: z.string().datetime().nullable(),
  programmeIds: z.array(z.string().uuid()),
  geofence: projectGeofenceSchema.nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const projectPageSchema = z.object({
  items: z.array(projectSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export const createProjectSchema = z
  .object({
    name: z.string().min(3).max(200),
    type: z.enum(PROJECT_TYPES).optional(),
    description: z.string().max(2000).nullable().optional(),
    organisationId: uuidSchema.nullable().optional(),
    districtId: uuidSchema.nullable().optional(),
    programmeIds: z.array(uuidSchema).max(20).optional(),
  })
  .strict();

export const transitionProjectSchema = z
  .object({
    to: z.enum(PROJECT_STATUSES),
    note: z.string().max(500).optional(),
  })
  .strict();

export const projectListQuerySchema = paginationSchema.extend({
  status: z.enum(PROJECT_STATUSES).optional(),
  organisationId: uuidSchema.optional(),
  jurisdictionId: uuidSchema.optional(),
});

/** Runtime re-statement of the domain transition table for validation at the boundary. */
export function isAllowedTransition(
  from: (typeof PROJECT_STATUSES)[number],
  to: (typeof PROJECT_STATUSES)[number],
): boolean {
  return PROJECT_TRANSITIONS[from].includes(to);
}
