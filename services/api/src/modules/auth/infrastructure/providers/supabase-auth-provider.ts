import { jwtVerify } from "jose";
import type { Identity } from "@netram/types";

interface SupabaseUserMetadata {
  name?: string;
}

interface SupabaseTokenPayload {
  sub?: string;
  email?: string;
  user_metadata?: SupabaseUserMetadata;
  raw_user_meta_data?: SupabaseUserMetadata;
}

/**
 * Supabase Auth provider.
 *
 * Validates JWTs issued by a Supabase instance (HS256, signed with the
 * project's JWT secret). The Netram application only ever sees the
 * provider-neutral {@link Identity} shape.
 */
export class SupabaseAuthProvider {
  constructor(private readonly jwtSecret: string) {}

  async verifyIdentity(token: string): Promise<Identity> {
    const key = new TextEncoder().encode(this.jwtSecret);
    try {
      const { payload } = await jwtVerify(token, key);
      const email = typeof payload.email === "string" ? payload.email : null;
      const meta = payload as unknown as SupabaseTokenPayload;
      const displayName =
        typeof meta.user_metadata?.name === "string"
          ? meta.user_metadata.name
          : typeof meta.raw_user_meta_data?.name === "string"
            ? meta.raw_user_meta_data.name
            : null;
      return {
        provider: "supabase",
        providerSubject: payload.sub ?? null,
        email,
        displayName,
        userId: null,
      };
    } catch {
      throw new Error("Invalid Supabase token");
    }
  }
}
