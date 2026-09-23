import { z } from "zod";
import { uuidSchema } from "./common.js";
import { PROGRAMME_SCOPE_LEVELS } from "@netram/types";

export const createOrganisationSchema = z
  .object({
    code: z
      .string()
      .min(3)
      .max(50)
      .regex(/^[A-Z0-9-]+$/, "Code must be uppercase letters, digits or dashes."),
    name: z.string().min(3).max(300),
    category: z.string().min(2).max(80),
  })
  .strict();

/**
 * Scheme/programme registration. Geographic scope is mandatory and the
 * territorial reference must match the chosen scope level.
 */
export const createProgrammeSchema = z
  .object({
    code: z
      .string()
      .min(3)
      .max(50)
      .regex(/^[A-Z0-9-]+$/, "Code must be uppercase letters, digits or dashes."),
    name: z.string().min(3).max(300),
    description: z.string().max(1000).nullable().optional(),
    scopeLevel: z.enum(PROGRAMME_SCOPE_LEVELS),
    stateId: uuidSchema.nullable().optional(),
    districtId: uuidSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (v) =>
      (v.scopeLevel === "national" && !v.stateId && !v.districtId) ||
      (v.scopeLevel === "state" && !!v.stateId && !v.districtId) ||
      (v.scopeLevel === "district" && !!v.districtId && !v.stateId),
    {
      message:
        "Scope mismatch: pick a state for state schemes, a district for district schemes, neither for national.",
    },
  );

export const registerInspectorSchema = z
  .object({
    email: z.string().email().max(255),
    displayName: z.string().min(2).max(200),
    phone: z.string().min(6).max(20).nullable().optional(),
    jurisdictionId: uuidSchema,
  })
  .strict();

export const registerOfficialSchema = z
  .object({
    email: z.string().email().max(255),
    displayName: z.string().min(2).max(200),
    roleCode: z.string().min(1).max(50),
    authorityId: uuidSchema.nullable().optional(),
    jurisdictionId: uuidSchema.nullable().optional(),
    scope: z.enum(["national", "jurisdiction"]),
  })
  .strict();

export const organisationSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  category: z.string(),
  authorityId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
});

export const programmeSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  scopeLevel: z.enum(PROGRAMME_SCOPE_LEVELS),
  stateId: z.string().uuid().nullable(),
  districtId: z.string().uuid().nullable(),
  authorityId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
});

export const registryUserViewSchema = z.object({
  userId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  email: z.string(),
  displayName: z.string().nullable(),
  roleCode: z.string(),
  status: z.string(),
});

export const stateViewSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
});

export const districtViewSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  stateId: z.string().uuid(),
  stateName: z.string(),
});
