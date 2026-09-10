import type { AuditAction, AuditEvent, AuditListQuery } from "@netram/types";

export interface AuditAppendCommand {
  action: AuditAction;
  actorUserId: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuditListFilter extends AuditListQuery {
  page: number;
  pageSize: number;
}

export interface AuditRepositoryPort {
  append(entry: AuditAppendCommand): Promise<void>;
  list(filter: AuditListFilter): Promise<{ items: AuditEvent[]; total: number }>;
}
