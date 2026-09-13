import { cache } from "react";
import { NetramApiClient } from "@netram/api-client";
import { cookies } from "next/headers";
import { loadClientEnv } from "@netram/config";

export const SESSION_COOKIE = "netram_session";

/** Server-side API client authenticated with the session token set at login. */
export async function getClient(): Promise<NetramApiClient> {
  const env = loadClientEnv();
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value ?? null;
  return new NetramApiClient({
    baseUrl: env.NEXT_PUBLIC_API_URL,
    getToken: () => token,
  });
}

export async function getSessionUser() {
  const client = await getClient();
  try {
    return await client.me();
  } catch {
    return null;
  }
}

/** Deduplicates the session fetch across layout + page renders in one request. */
export const getCachedSessionUser = cache(getSessionUser);
