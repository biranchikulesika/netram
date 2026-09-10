import type { AuditAction } from "@netram/types";

export interface AuditEntry {
  action: AuditAction;
  actorUserId: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Audit is an application-layer responsibility: the frontend must never be
 * trusted to request that an action be recorded. Persistence of audit rows is
 * delegated to the data layer.
 */
export interface AuditRepositoryPort {
  append(entry: AuditEntry): Promise<void>;
}
