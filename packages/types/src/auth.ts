import type { UUID, ISODateTime } from "./common.js";

export type IdentityProvider = "dev" | "supabase" | "govt_sso";

/** Provider-neutral identity produced by an AuthProvider. */
export interface Identity {
  provider: IdentityProvider;
  providerSubject: string | null;
  email: string | null;
  displayName: string | null;
  /** Netram user id once the identity is linked to a repository user. */
  userId: UUID | null;
}

export interface AuthenticatedUser {
  id: UUID;
  email: string;
  displayName: string | null;
  type: "netram" | "external";
}

/** Provider-neutral session handle. */
export interface Session {
  id: UUID;
  userId: UUID;
  provider: IdentityProvider;
  issuedAt: ISODateTime;
  expiresAt: ISODateTime | null;
}

/** Contract implemented by authentication providers (e.g. Supabase Auth, dev provider). */
export interface AuthProviderPort {
  verifyIdentity(token: string): Promise<Identity>;
  createSession?(identity: Identity): Promise<Session>;
  revokeSession?(sessionId: string): Promise<void>;
  getIdentity?(sessionId: string): Promise<Identity | null>;
}

export interface AuthApi {
  /** Mint a session token for an already-verified identity. Returns opaque token string. */
  createSessionToken(identity: Identity): Promise<string>;
  verifyIdentity(token: string): Promise<Identity>;
}
