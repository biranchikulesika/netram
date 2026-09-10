import { createHmac } from "node:crypto";
import type { VcSession, VcParticipantRole, VcJoinDetails } from "@netram/types";
import type { VcProviderPort } from "../../application/ports/vc-provider-port.js";

export interface WebRtcMeshProviderConfig {
  signingSecret: string;
  iceServers?: Array<{ urls: string | string[] }>;
}

export class WebRtcMeshProvider implements VcProviderPort {
  private readonly secret: string;
  private readonly iceServers: Array<{ urls: string | string[] }>;

  constructor(config: WebRtcMeshProviderConfig) {
    this.secret = config.signingSecret;
    this.iceServers = config.iceServers ?? [
      { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    ];
  }

  async createRoom(session: { id: string; title: string }): Promise<{ roomName: string }> {
    const slug = session.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40);
    const roomName = `netram-vc-${slug}-${session.id.slice(0, 8)}`;
    return { roomName };
  }

  async generateJoinDetails(
    session: VcSession,
    user: { id: string; email: string },
    role: VcParticipantRole,
  ): Promise<VcJoinDetails> {
    const exp = Math.floor(Date.now() / 1000) + 7200; // 2 hours
    const payload = {
      sessionId: session.id,
      roomName: session.roomName,
      userId: user.id,
      role,
      exp,
    };

    const dataB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const signature = createHmac("sha256", this.secret).update(dataB64).digest("base64url");
    const token = `${dataB64}.${signature}`;

    return {
      sessionId: session.id,
      roomName: session.roomName,
      token,
      role,
      provider: session.provider,
      webrtcConfig: {
        iceServers: this.iceServers,
      },
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }
}
