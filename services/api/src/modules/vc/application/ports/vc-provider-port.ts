import type { VcSession, VcParticipantRole, VcJoinDetails } from "@netram/types";

export interface VcProviderPort {
  createRoom(session: { id: string; title: string }): Promise<{ roomName: string }>;
  generateJoinDetails(
    session: VcSession,
    user: { id: string; email: string },
    role: VcParticipantRole,
  ): Promise<VcJoinDetails>;
}
