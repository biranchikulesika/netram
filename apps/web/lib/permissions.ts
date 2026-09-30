/**
 * Server-side permission checks for web pages (§16, §34).
 *
 * Pages use these to decide which data to FETCH and which sections to render.
 * Information the caller is not authorised to see must not be sent to the
 * client at all - omission happens here, server-side, before serialization.
 *
 * NOTE: this mirrors the caller's granted permissions; the API independently
 * re-enforces every authorisation decision server-side.
 */

export type Permissions = readonly string[];

export function can(permissions: Permissions, permission: string): boolean {
  return permissions.includes(permission);
}

/** True when the caller holds ANY of the listed permissions. */
export function canAny(permissions: Permissions, required: readonly string[]): boolean {
  return required.some((permission) => permissions.includes(permission));
}
