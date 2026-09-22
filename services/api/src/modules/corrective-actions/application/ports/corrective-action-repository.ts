import type {
  AuditAction,
  CorrectiveAction,
  CorrectiveActionFile,
  CorrectiveActionStatus,
  DomainEventType,
  UUID,
} from "@netram/types";

export interface CorrectiveActionWriteContext {
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface CreateCorrectiveActionCommand extends CorrectiveActionWriteContext {
  id: string;
  findingId: UUID;
  inspectionId: UUID;
  organisationId: UUID | null;
  deadline: Date | string | null;
}

/**
 * Corrective action status is a byproduct of recorded work — never a manual
 * toggle. The target status and work fields are persisted atomically with the
 * audit record and outbox event.
 */
export interface CorrectiveActionWorkCommand extends CorrectiveActionWriteContext {
  correctiveActionId: UUID;
  to: CorrectiveActionStatus;
  note: string | null;
  /** ATR content supplied on the submit step (docs/DoSJE.md §16). */
  actionSummary?: string | null;
  /** Attachments lodged with the ATR; replaces any earlier submission's files. */
  files?: {
    id: UUID;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    contentHash: string;
    storageKey: string;
  }[];
}

export interface CorrectiveActionFileWithStorageKey {
  file: CorrectiveActionFile;
  correctiveActionId: UUID;
  storageKey: string;
}

export interface CorrectiveActionWithDistrict extends CorrectiveAction {
  districtId: string | null;
}

export interface CorrectiveActionListFilter {
  findingId?: UUID;
  inspectionId?: UUID;
  status?: CorrectiveActionStatus;
  organisationId?: UUID;
  jurisdictionIds?: UUID[];
  page: number;
  pageSize: number;
}

export interface CorrectiveActionRepositoryPort {
  list(filter: CorrectiveActionListFilter): Promise<{ items: CorrectiveAction[]; total: number }>;
  findById(id: UUID): Promise<CorrectiveActionWithDistrict | null>;
  createWithAuditAndEvent(cmd: CreateCorrectiveActionCommand): Promise<CorrectiveAction>;
  applyWorkWithAuditAndEvent(
    cmd: CorrectiveActionWorkCommand,
  ): Promise<CorrectiveActionWithDistrict>;
  findFileById(id: UUID): Promise<CorrectiveActionFileWithStorageKey | null>;
  markOverdueActions(actorUserId?: string | null): Promise<{
    count: number;
    actionIds: string[];
  }>;
}
