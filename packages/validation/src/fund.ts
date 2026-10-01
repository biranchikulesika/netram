import { z } from "zod";
import { uuidSchema, paginationSchema } from "./common.js";

export const moneyRegex = /^\d+(\.\d{1,2})?$/;
export const moneySchema = z
  .string()
  .regex(moneyRegex, "Amount must be a valid decimal string with up to 2 decimal places");

export const createAllocationSchema = z.object({
  projectId: uuidSchema,
  programmeId: uuidSchema.optional(),
  organisationId: uuidSchema.optional(),
  allocatedAmount: moneySchema,
  fiscalYear: z.string().min(4).max(10),
  currency: z.string().max(5).default("INR").optional(),
  scheme: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

export const updateAllocationSchema = z.object({
  allocatedAmount: moneySchema.optional(),
  status: z.enum(["active", "revised", "cancelled"]).optional(),
  scheme: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

export const createReleaseSchema = z.object({
  allocationId: uuidSchema,
  releasedAmount: moneySchema,
  releaseDate: z.string().datetime(),
  referenceNumber: z.string().min(1).max(100),
  remarks: z.string().optional(),
});

export const createExpenseSchema = z.object({
  projectId: uuidSchema,
  organisationId: uuidSchema.optional(),
  allocationId: uuidSchema.optional(),
  category: z.string().min(1).max(80),
  description: z.string().min(1),
  amount: moneySchema,
  transactionDate: z.string().datetime(),
  vendorName: z.string().min(1).max(300),
  vendorGstin: z.string().max(20).optional(),
  invoiceNumber: z.string().max(100).optional(),
  invoiceDate: z.string().datetime().optional(),
  paymentReference: z.string().max(200).optional(),
  paymentMethod: z.string().max(50).optional(),
});

export const patchExpenseSchema = z.object({
  category: z.string().min(1).max(80).optional(),
  description: z.string().min(1).optional(),
  amount: moneySchema.optional(),
  transactionDate: z.string().datetime().optional(),
  vendorName: z.string().min(1).max(300).optional(),
  vendorGstin: z.string().max(20).optional().nullable(),
  invoiceNumber: z.string().max(100).optional().nullable(),
  invoiceDate: z.string().datetime().optional().nullable(),
  paymentReference: z.string().max(200).optional().nullable(),
  paymentMethod: z.string().max(50).optional().nullable(),
});

export const rejectExpenseSchema = z.object({
  reason: z.string().min(1),
});

export const voidExpenseSchema = z.object({
  voidReason: z.string().min(1),
});

export const verifyDocumentSchema = z.object({
  status: z.enum(["verified", "rejected", "flagged"]),
  rejectionReason: z.string().optional(),
});

export const createRiskRuleSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(80),
  description: z.string().min(1),
  conditionConfig: z.record(z.string(), z.unknown()).default({}),
  weight: z.number().int().min(1).max(100),
  severity: z.enum(["low", "medium", "high", "critical"]),
  enabled: z.boolean().default(true).optional(),
});

export const patchRiskRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(80).optional(),
  description: z.string().min(1).optional(),
  conditionConfig: z.record(z.string(), z.unknown()).optional(),
  weight: z.number().int().min(1).max(100).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  enabled: z.boolean().optional(),
});

export const assignFlagSchema = z.object({
  assignedInspectorId: uuidSchema,
});

export const reviewFlagSchema = z.object({
  reviewNotes: z.string().min(1),
  status: z.enum(["under_review", "assigned", "inspection_in_progress"]).optional(),
});

export const resolveFlagSchema = z.object({
  resolution: z.string().min(1),
});

export const dismissFlagSchema = z.object({
  dismissedReason: z.string().min(1),
});

export const allocationListQuerySchema = paginationSchema.extend({
  projectId: uuidSchema.optional(),
  organisationId: uuidSchema.optional(),
  fiscalYear: z.string().optional(),
  status: z.enum(["active", "revised", "cancelled"]).optional(),
});

export const expenseListQuerySchema = paginationSchema.extend({
  projectId: uuidSchema.optional(),
  organisationId: uuidSchema.optional(),
  allocationId: uuidSchema.optional(),
  status: z
    .enum(["draft", "submitted", "under_review", "verified", "rejected", "voided"])
    .optional(),
  category: z.string().optional(),
  vendorName: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const inspectionFlagListQuerySchema = paginationSchema.extend({
  projectId: uuidSchema.optional(),
  organisationId: uuidSchema.optional(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z
    .enum([
      "open",
      "under_review",
      "assigned",
      "inspection_in_progress",
      "inspection_completed",
      "resolved",
      "dismissed",
    ])
    .optional(),
  assignedInspectorId: uuidSchema.optional(),
});

export type CreateAllocationInput = z.infer<typeof createAllocationSchema>;
export type UpdateAllocationInput = z.infer<typeof updateAllocationSchema>;
export type CreateReleaseInput = z.infer<typeof createReleaseSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type PatchExpenseInput = z.infer<typeof patchExpenseSchema>;
export type RejectExpenseInput = z.infer<typeof rejectExpenseSchema>;
export type VoidExpenseInput = z.infer<typeof voidExpenseSchema>;
export type VerifyDocumentInput = z.infer<typeof verifyDocumentSchema>;
export type CreateRiskRuleInput = z.infer<typeof createRiskRuleSchema>;
export type PatchRiskRuleInput = z.infer<typeof patchRiskRuleSchema>;
export type AssignFlagInput = z.infer<typeof assignFlagSchema>;
export type ReviewFlagInput = z.infer<typeof reviewFlagSchema>;
export type ResolveFlagInput = z.infer<typeof resolveFlagSchema>;
export type DismissFlagInput = z.infer<typeof dismissFlagSchema>;
export type AllocationListQueryInput = z.infer<typeof allocationListQuerySchema>;
export type ExpenseListQueryInput = z.infer<typeof expenseListQuerySchema>;
export type InspectionFlagListQueryInput = z.infer<typeof inspectionFlagListQuerySchema>;
