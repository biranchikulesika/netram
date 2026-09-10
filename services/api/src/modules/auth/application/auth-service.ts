import { AppError } from "../../../infrastructure/errors.js";
import type { AuthProvider } from "./auth-provider-port.js";
import type { UserRepository, AuthorizationRepository, AssignmentContext } from "@netram/data";
import type { AuthenticatedUser } from "@netram/types";

export interface AuthContext {
  user: AuthenticatedUser;
  assignments: AssignmentContext[];
  permissions: Set<string>;
  userId: string;
}

export class AuthService {
  constructor(
    private readonly provider: AuthProvider,
    private readonly users: UserRepository,
    private readonly authorization: AuthorizationRepository,
  ) {}

  /** Authenticates a bearer token to a Netram user and loads their authorization context. */
  async authenticate(token: string): Promise<AuthContext> {
    let identity: {
      provider: string;
      providerSubject: string | null;
      email: string | null;
      displayName: string | null;
      userId: string | null;
    };
    try {
      identity = await this.provider.verifyIdentity(token);
    } catch {
      throw AppError.unauthorized("Invalid or expired token.");
    }

    if (!identity.userId) {
      // Provider identity exists but is not linked to a Netram user yet.
      throw AppError.unauthorized("Identity is not linked to a Netram user.");
    }

    const user = await this.users.findById(identity.userId);
    if (!user || user.status !== "active") {
      throw AppError.unauthorized("User is not active.");
    }

    const authz = await this.authorization.getContext(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        type: "netram",
      },
      assignments: authz.assignments,
      permissions: authz.allPermissions,
      userId: user.id,
    };
  }

  /** Development-only login: resolves a seed user and mints a dev JWT. */
  async devLogin(
    email: string,
    signer: (userId: string, email: string, displayName: string | null) => Promise<string>,
  ): Promise<{ token: string; user: AuthenticatedUser }> {
    const user = await this.users.findByEmail(email);
    if (!user) throw AppError.notFound(`No development user with email ${email}.`);
    const token = await signer(user.id, user.email, user.displayName);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        type: "netram",
      },
    };
  }
}
