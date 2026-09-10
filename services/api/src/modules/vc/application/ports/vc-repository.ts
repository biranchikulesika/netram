import type {
  VcSessionWithParticipants,
  VcSessionStatus,
  VcParticipant,
  VcParticipantRole,
} from "@netram/types";
import type { VcWriteContext, VcSessionListFilter } from "@netram/data";

export interface VcRepositoryPort {
  findById(id: string): Promise<VcSessionWithParticipants | null>;
  list(filter: VcSessionListFilter): Promise<{ items: VcSessionWithParticipants[]; total: number }>;
  create(
    input: {
      id?: string;
      title: string;
      inspectionId?: string | null;
      projectId?: string | null;
      hostUserId: string;
      roomName: string;
      provider: string;
      scheduledAt?: Date | null;
      metadata?: Record<string, unknown> | null;
      participants?: Array<{ userId: string; role: VcParticipantRole }>;
    },
    context: VcWriteContext,
  ): Promise<VcSessionWithParticipants>;
  updateStatus(
    id: string,
    status: VcSessionStatus,
    timestamps: { startedAt?: Date; endedAt?: Date },
    context: VcWriteContext,
  ): Promise<VcSessionWithParticipants>;
  recordParticipantJoin(
    sessionId: string,
    userId: string,
    role: VcParticipantRole,
    context?: VcWriteContext,
  ): Promise<VcParticipant>;
  recordParticipantLeave(
    sessionId: string,
    userId: string,
    context?: VcWriteContext,
  ): Promise<void>;
}
