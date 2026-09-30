import { cache } from "react";
import { ApiError, NetramApiClient } from "@netram/api-client";
import { cookies } from "next/headers";
import { loadClientEnv } from "@netram/config";

export const SESSION_COOKIE = "netram_session";

/** Server-side API client authenticated with the session token set at login. */
export async function getClient(): Promise<NetramApiClient> {
  const env = loadClientEnv();
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value ?? null;
  return new NetramApiClient({
    baseUrl: env.NETRAM_API_BASE_URL,
    getToken: () => token,
  });
}

export type SessionPayload = Awaited<ReturnType<NetramApiClient["me"]>>;

/**
 * Why the session state is three-valued rather than "user or null".
 *
 * Collapsing "nobody is signed in" and "we could not find out" into the same
 * value is fine for a page guard - an unknown session must fail closed. It is
 * NOT fine for the login page, which renders a sign-in form whenever it sees
 * no user: during any transient API failure (the demo database being rebuilt,
 * the API restarting) an already-authenticated visitor would be shown the
 * login screen. So the ambiguity is resolved once, here, and callers pick the
 * behaviour that suits them.
 */
export type SessionState =
  /** No session cookie, or the API rejected the token: genuinely signed out. */
  | { status: "anonymous" }
  /** Session cookie verified against the API. */
  | { status: "authenticated"; session: SessionPayload }
  /** Session cookie present but the API could not be asked: unknown, not anonymous. */
  | { status: "unverified" };

/** Deduplicates the session fetch across layout + page renders in one request. */
export const getSessionState = cache(async (): Promise<SessionState> => {
  const store = await cookies();
  if (!store.get(SESSION_COOKIE)?.value) return { status: "anonymous" };

  const client = await getClient();
  try {
    return { status: "authenticated", session: await client.me() };
  } catch (err) {
    // 401/403 is a real answer: the token is not usable. Anything else (5xx,
    // unreachable API, dropped database) is an unknown we must not report as
    // "signed out".
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      return { status: "anonymous" };
    }
    return { status: "unverified" };
  }
});

export async function getSessionUser(): Promise<SessionPayload | null> {
  const state = await getSessionState();
  return state.status === "authenticated" ? state.session : null;
}

/** Deduplicates the session fetch across layout + page renders in one request. */
export const getCachedSessionUser = cache(getSessionUser);
