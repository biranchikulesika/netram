import { z } from "zod";

export const callRoleSchema = z.enum(["staff", "beneficiary"]);
export const callDirectionSchema = z.enum(["incoming", "outgoing"]);
export const callStatusSchema = z.enum(["answered", "missed"]);
export const callConditionSchema = z.enum(["satisfactory", "minor_issue", "critical_problem"]);

export const callContactSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  role: callRoleSchema,
  title: z.string().min(1).max(200),
  projectId: z.string().uuid().nullable().optional(),
  projectCode: z.string().min(1).max(50),
  projectName: z.string().min(1).max(300),
  phone: z.string().min(1).max(40),
  isOnline: z.boolean().default(true),
  avatarColor: z.string().min(1).max(30).default("#2563EB"),
  videoUri: z.string().nullable().optional(),
});

export const callRecordSchema = z.object({
  id: z.string().min(1).max(64),
  contactId: z.string().min(1).max(64),
  contactName: z.string().min(1).max(200),
  contactTitle: z.string().min(1).max(200),
  role: callRoleSchema,
  projectId: z.string().uuid().nullable().optional(),
  projectCode: z.string().min(1).max(50),
  projectName: z.string().min(1).max(300),
  callType: z.literal("video").default("video"),
  durationSeconds: z.coerce.number().int().min(0).default(0),
  timestamp: z.string(),
  condition: callConditionSchema.default("satisfactory"),
  reviewText: z.string(),
  flagInspection: z.boolean().default(false),
  videoUri: z.string().nullable().optional(),
  inspectorVideoUri: z.string().nullable().optional(),
  direction: callDirectionSchema.default("outgoing"),
  status: callStatusSchema.default("answered"),
  startedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().optional(),
});

export const createCallRecordSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  contactId: z.string().min(1).max(64),
  contactName: z.string().min(1).max(200),
  contactTitle: z.string().min(1).max(200),
  role: callRoleSchema,
  projectId: z.string().uuid().nullable().optional(),
  projectCode: z.string().min(1).max(50),
  projectName: z.string().min(1).max(300),
  callType: z.literal("video").default("video").optional(),
  durationSeconds: z.coerce.number().int().min(0).default(0),
  timestamp: z.string().optional(),
  condition: callConditionSchema.default("satisfactory"),
  reviewText: z.string(),
  flagInspection: z.boolean().default(false).optional(),
  videoUri: z.string().nullable().optional(),
  inspectorVideoUri: z.string().nullable().optional(),
  direction: callDirectionSchema.default("outgoing").optional(),
  status: callStatusSchema.default("answered").optional(),
});

export const listCallHistoryQuerySchema = z.object({
  contactId: z.string().optional(),
  projectId: z.string().uuid().optional(),
  direction: callDirectionSchema.optional(),
  status: callStatusSchema.optional(),
  page: z.coerce.number().int().positive().default(1).optional(),
  pageSize: z.coerce.number().int().positive().max(100).default(50).optional(),
});

export type CallContactInput = z.infer<typeof callContactSchema>;
export type CallRecordInput = z.infer<typeof callRecordSchema>;
export type CreateCallRecordInput = z.infer<typeof createCallRecordSchema>;
export type ListCallHistoryQuery = z.infer<typeof listCallHistoryQuerySchema>;
