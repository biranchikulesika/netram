/**
 * API routes that require NO authentication, as a contract.
 *
 * This list is shared between the API (which marks these routes public and skips
 * authentication for them) and the web BFF (which must proxy them through
 * WITHOUT a session token, otherwise the unauthenticated entry points can never
 * be reached - see `apps/web/app/api/v1/[...path]/route.ts`).
 *
 * It lives here rather than in the API because it is a contract between the API
 * and its callers, not an implementation detail of the API. Both sides depend on
 * this shared package; neither imports the other (§63 cross-service boundary).
 *
 * Paths are full request paths, relative to the API origin, and are matched by
 * prefix. Keep the two sides in step by editing this file only.
 */
export const PUBLIC_API_PATH_PREFIXES = [
  "/docs",
  "/openapi.json",
  "/health",
  "/ready",
  "/api/v1/auth/dev-login",
  "/api/v1/info",
  "/api/v1/complaints/track",
  "/api/v1/projects/registry",
] as const;

/** True when `path` is an API path that needs no session token. */
export function isPublicApiPath(path: string): boolean {
  return PUBLIC_API_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
