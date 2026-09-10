import type { DomainEventType, Page, Project, ProjectStatus } from "@netram/types";
import type { AuditAction } from "@netram/types";

export interface CreateProjectCommand {
  id: string;
  code: string;
  name: string;
  type: Project["type"];
  description: string | null;
  organisationId: string | null;
  authorityId: string | null;
  districtId: string | null;
  programmeIds: string[];
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface TransitionProjectCommand {
  projectId: string;
  to: ProjectStatus;
  approvedById: string | null;
  approvedAt: Date | null;
  note: string | null;
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface ProjectListFilter {
  status?: ProjectStatus;
  organisationId?: string;
  jurisdictionIds?: string[];
  page: number;
  pageSize: number;
}

export interface ProjectRepositoryPort {
  findById(id: string): Promise<Project | null>;
  findByCode?(code: string): Promise<Project | null>;
  list(filter: ProjectListFilter): Promise<Page<Project>>;
  createWithAuditAndEvent(cmd: CreateProjectCommand): Promise<Project>;
  transitionProjectWithAuditAndEvent(cmd: TransitionProjectCommand): Promise<Project>;
}
