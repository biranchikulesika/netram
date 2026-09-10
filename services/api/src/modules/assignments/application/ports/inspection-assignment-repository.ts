import type { AssignmentRole, InspectionAssignment, UUID } from "@netram/types";

export interface AssignInspectorCommand {
  id: UUID;
  inspectionId: UUID;
  userId: UUID;
  role: AssignmentRole;
  actorUserId: UUID;
  requestId: string | null;
  ipAddress: string | null;
}

export interface InspectionAssignmentRepositoryPort {
  listByInspection(inspectionId: UUID): Promise<InspectionAssignment[]>;
  listByUser(
    userId: UUID,
    page: number,
    pageSize: number,
  ): Promise<{ items: InspectionAssignment[]; total: number }>;
  findById(id: UUID): Promise<InspectionAssignment | null>;
  assignWithAuditAndEvent(cmd: AssignInspectorCommand): Promise<InspectionAssignment>;
  remove(id: UUID): Promise<void>;
}
