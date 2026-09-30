import type { AuditAction } from "@netram/types";

/**
 * Audit events are append-only. There are no lifecycle transitions - once
 * written, an audit record is immutable (AGENTS.md §37).
 *
 * This module exists to hold audit-specific domain rules such as
 * action classification and filtering constraints.
 */

const SENSITIVE_ACTIONS: readonly AuditAction[] = [
  "auth.authenticated",
  "auth.authorization_failed",
  "role.changed",
  "role.assignment_changed",
  "admin.action",
] as const;

/** Whether an action should trigger heightened scrutiny / additional metadata capture. */
export function isSensitiveAction(action: AuditAction): boolean {
  return (SENSITIVE_ACTIONS as readonly string[]).includes(action);
}
