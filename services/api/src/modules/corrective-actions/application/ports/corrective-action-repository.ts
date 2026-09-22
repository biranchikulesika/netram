import type {
  AuditAction,
  CorrectiveAction,
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

export interface TransitionCorrectiveActionCommand extends CorrectiveActionWriteContext {
  correctiveActionId: UUID;
  to: CorrectiveActionStatus;
  note: string | null;
  /** ATR content supplied on the submit step (docs/DoSJE.md §16). */
  actionSummary?: string | null;
  atrCode?: string | null;
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
  transitionWithAuditAndEvent(
    cmd: TransitionCorrectiveActionCommand,
  ): Promise<CorrectiveActionWithDistrict>;
  markOverdueActions(actorUserId?: string | null): Promise<{
    count: number;
    actionIds: string[];
  }>;
}
