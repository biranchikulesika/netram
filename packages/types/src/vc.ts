import type { UUID } from "./common.js";

export const VC_SESSION_STATUSES = ["scheduled", "active", "completed", "cancelled"] as const;
export type VcSessionStatus = (typeof VC_SESSION_STATUSES)[number];

export const VC_PARTICIPANT_ROLES = [
  "host",
  "inspector",
  "officer",
  "organisation_rep",
  "observer",
] as const;
export type VcParticipantRole = (typeof VC_PARTICIPANT_ROLES)[number];

export interface VcSession {
  id: UUID;
  inspectionId?: UUID | null;
  projectId?: UUID | null;
  title: string;
  status: VcSessionStatus;
  hostUserId?: UUID | null;
  roomName: string;
  provider: string;
  scheduledAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface VcParticipant {
  id: UUID;
  sessionId: UUID;
  userId: UUID;
  role: VcParticipantRole;
  joinedAt?: string | null;
  leftAt?: string | null;
  createdAt: string;
}

export interface VcSessionWithParticipants extends VcSession {
  participants: VcParticipant[];
  projectName?: string | null;
  hostEmail?: string | null;
}

export interface VcJoinDetails {
  sessionId: UUID;
  roomName: string;
  token: string;
  role: VcParticipantRole;
  provider: string;
  webrtcConfig: {
    iceServers: Array<{ urls: string | string[] }>;
  };
  user: {
    id: UUID;
    email: string;
  };
}

export interface CreateVcSessionInput {
  title: string;
  inspectionId?: UUID;
  projectId?: UUID;
  scheduledAt?: string;
  provider?: string;
  metadata?: Record<string, unknown>;
  participants?: Array<{ userId: UUID; role: VcParticipantRole }>;
}

export interface ListVcSessionsFilter {
  inspectionId?: UUID;
  projectId?: UUID;
  status?: VcSessionStatus;
  page?: number;
  pageSize?: number;
}
