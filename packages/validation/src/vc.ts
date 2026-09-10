import { z } from "zod";
import { VC_SESSION_STATUSES, VC_PARTICIPANT_ROLES } from "@netram/types";

export const createVcSessionSchema = z.object({
  title: z.string().min(1).max(200),
  inspectionId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  scheduledAt: z.string().datetime().optional(),
  provider: z.string().min(1).max(50).default("webrtc").optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  participants: z
    .array(
      z.object({
        userId: z.string().uuid(),
        role: z.enum(VC_PARTICIPANT_ROLES),
      }),
    )
    .optional(),
});

export const updateVcSessionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  status: z.enum(VC_SESSION_STATUSES).optional(),
});

export const joinVcSessionSchema = z.object({
  role: z.enum(VC_PARTICIPANT_ROLES).optional(),
});

export const listVcSessionsQuerySchema = z.object({
  inspectionId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  status: z.enum(VC_SESSION_STATUSES).optional(),
  page: z.coerce.number().int().positive().default(1).optional(),
  pageSize: z.coerce.number().int().positive().max(100).default(20).optional(),
});

export const vcParticipantSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(VC_PARTICIPANT_ROLES),
  joinedAt: z.string().nullable().optional(),
  leftAt: z.string().nullable().optional(),
  createdAt: z.string(),
});

export const vcSessionSchema = z.object({
  id: z.string().uuid(),
  inspectionId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  title: z.string(),
  status: z.enum(VC_SESSION_STATUSES),
  hostUserId: z.string().uuid().nullable().optional(),
  roomName: z.string(),
  provider: z.string(),
  scheduledAt: z.string().nullable().optional(),
  startedAt: z.string().nullable().optional(),
  endedAt: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const vcSessionWithParticipantsSchema = vcSessionSchema.extend({
  participants: z.array(vcParticipantSchema),
  projectName: z.string().nullable().optional(),
  hostEmail: z.string().nullable().optional(),
});

export const vcSessionPageSchema = z.object({
  items: z.array(vcSessionWithParticipantsSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export const vcJoinDetailsSchema = z.object({
  sessionId: z.string().uuid(),
  roomName: z.string(),
  token: z.string(),
  role: z.enum(VC_PARTICIPANT_ROLES),
  provider: z.string(),
  webrtcConfig: z.object({
    iceServers: z.array(
      z.object({
        urls: z.union([z.string(), z.array(z.string())]),
      }),
    ),
  }),
  user: z.object({
    id: z.string().uuid(),
    email: z.string(),
  }),
});

export type CreateVcSessionInput = z.infer<typeof createVcSessionSchema>;
export type UpdateVcSessionInput = z.infer<typeof updateVcSessionSchema>;
export type JoinVcSessionInput = z.infer<typeof joinVcSessionSchema>;
export type ListVcSessionsQuery = z.infer<typeof listVcSessionsQuerySchema>;
export type VcParticipantDto = z.infer<typeof vcParticipantSchema>;
export type VcSessionDto = z.infer<typeof vcSessionSchema>;
export type VcSessionWithParticipantsDto = z.infer<typeof vcSessionWithParticipantsSchema>;
export type VcSessionPageDto = z.infer<typeof vcSessionPageSchema>;
export type VcJoinDetailsDto = z.infer<typeof vcJoinDetailsSchema>;
