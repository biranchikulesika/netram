import type {
  DomainEventType,
  Page,
  Project,
  ProjectGeofence,
  GeofenceType,
  ProjectStatus,
} from "@netram/types";
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
  villageId: string | null;
  schemeComponentId: string | null;
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

export interface SealGeofencePortCommand {
  projectId: string;
  type: GeofenceType;
  radiusMeters: number;
  centerLat: number | null;
  centerLng: number | null;
  polygonVertices: [number, number][];
  sealedById: string | null;
  sealedAt: Date;
  auditTx: string | null;
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface UpdateProjectCommand {
  projectId: string;
  name: string;
  type: Project["type"];
  description: string | null;
  organisationId: string | null;
  districtId: string | null;
  villageId: string | null;
  schemeComponentId: string | null;
  programmeIds: string[];
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
  updateWithAuditAndEvent(cmd: UpdateProjectCommand): Promise<Project>;
  transitionProjectWithAuditAndEvent(cmd: TransitionProjectCommand): Promise<Project>;
  findGeofenceByProjectId(projectId: string): Promise<ProjectGeofence | null>;
  listGeofences(projectIds?: string[]): Promise<ProjectGeofence[]>;
  sealGeofenceWithAuditAndEvent(cmd: SealGeofencePortCommand): Promise<ProjectGeofence>;
}

