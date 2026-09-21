import { redirect } from "next/navigation";
import type { JurisdictionView } from "@netram/types";
import { getClient, getSessionUser } from "../../../lib/api";

/**
 * Server-side gate for a registry form page. Mirrors the capability matrix:
 * a user without the permission is redirected (the API also re-checks the
 * permission on submit — the page gate is usability, the 403 is enforcement).
 */
export async function requireRegistryPermission(permission: string) {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (!session.permissions.includes(permission)) redirect("/registry");
  return session;
}

/** Jurisdictions for inspector/official assignment pickers. */
export async function loadJurisdictions(): Promise<JurisdictionView[]> {
  try {
    return await (await getClient()).listJurisdictions();
  } catch {
    return [];
  }
}

/** States + districts for scheme-scope and agency-district pickers. */
export async function loadTerritories() {
  const client = await getClient();
  const [states, districts] = await Promise.all([
    client.listStates().catch(() => []),
    client.listRegistryDistricts().catch(() => []),
  ]);
  return { states, districts };
}
