import type { Identity } from "@netram/types";

/** The auth provider contract the API depends on. */
export interface AuthProvider {
  verifyIdentity(token: string): Promise<Identity>;
}

export type { Identity };
