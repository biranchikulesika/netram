import { SignJWT, jwtVerify } from "jose";
import type { Identity } from "@netram/types";

export interface DevTokenPayload {
  sub: string;
  email: string;
  displayName: string | null;
}

export class DevAuthProvider {
  constructor(private readonly secret: string) {}

  /**
   * Signs a development-only JWT for a resolved Netram user id.
   * This provider is never enabled in production (enforced by configuration).
   */
  async signDevToken(userId: string, email: string, displayName: string | null): Promise<string> {
    const key = new TextEncoder().encode(this.secret);
    return new SignJWT({ email, displayName })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("netram-dev")
      .setIssuedAt()
      .setExpirationTime("8h")
      .setSubject(userId)
      .sign(key);
  }

  async verifyIdentity(token: string): Promise<Identity> {
    const key = new TextEncoder().encode(this.secret);
    try {
      const { payload } = await jwtVerify(token, key, { issuer: "netram-dev" });
      const email = typeof payload.email === "string" ? payload.email : null;
      const displayName = typeof payload.displayName === "string" ? payload.displayName : null;
      return {
        provider: "dev",
        providerSubject: payload.sub ?? null,
        email,
        displayName,
        userId: payload.sub ?? null,
      };
    } catch {
      throw new Error("Invalid development token");
    }
  }
}
