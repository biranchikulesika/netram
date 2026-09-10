import { and, count, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  inspectionAssignments as assignmentsTable,
  inspections as inspectionsTable,
  projects as projectsTable,
  users as usersTable,
  auditEvents,
  outboxEvents,
  notifications as notificationsTable,
} from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type { AssignmentRole, InspectionAssignment } from "@netram/types";

export function toInspectionAssignment(row: {
  id: string;
  inspectionId: string;
  userId: string;
  role: string;
  assignedAt: Date;
  userName: string | null;
  inspectionStatus: string | null;
  inspectionType: string | null;
  projectCode: string | null;
  projectName: string | null;
  districtId: string | null;
}): InspectionAssignment {
  return {
    id: row.id,
    inspectionId: row.inspectionId,
    userId: row.userId,
    userName: row.userName,
    role: row.role as AssignmentRole,
    assignedAt: row.assignedAt.toISOString(),
    inspectionStatus: row.inspectionStatus,
    inspectionType: row.inspectionType,
    projectCode: row.projectCode,
    projectName: row.projectName,
    districtId: row.districtId,
  };
}

export interface AssignInspectorWrite {
  id: string;
  inspectionId: string;
  userId: string;
  role: AssignmentRole;
  actorUserId: string;
  requestId: string | null;
  ipAddress: string | null;
}

export class InspectionAssignmentRepository {
  constructor(private db: DrizzleDB) {}

  private baseJoin() {
    return this.db
      .select({
        id: assignmentsTable.id,
        inspectionId: assignmentsTable.inspectionId,
        userId: assignmentsTable.userId,
        role: assignmentsTable.role,
        assignedAt: assignmentsTable.assignedAt,
        userName: usersTable.displayName,
        inspectionStatus: inspectionsTable.status,
        inspectionType: inspectionsTable.type,
        projectCode: projectsTable.code,
        projectName: projectsTable.name,
        districtId: projectsTable.districtId,
      })
      .from(assignmentsTable)
      .innerJoin(usersTable, eq(assignmentsTable.userId, usersTable.id))
      .innerJoin(inspectionsTable, eq(assignmentsTable.inspectionId, inspectionsTable.id))
      .innerJoin(projectsTable, eq(inspectionsTable.projectId, projectsTable.id));
  }

  async listByInspection(inspectionId: string): Promise<InspectionAssignment[]> {
    const rows = await this.baseJoin()
      .where(eq(assignmentsTable.inspectionId, inspectionId))
      .orderBy(assignmentsTable.assignedAt);
    return rows.map((r) => toInspectionAssignment(r));
  }

  async listByUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: InspectionAssignment[]; total: number }> {
    const [rows, total] = await Promise.all([
      this.baseJoin()
        .where(eq(assignmentsTable.userId, userId))
        .orderBy(desc(assignmentsTable.assignedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: count() })
        .from(assignmentsTable)
        .where(eq(assignmentsTable.userId, userId)),
    ]);
    return {
      items: rows.map((r) => toInspectionAssignment(r)),
      total: total[0]?.count ?? 0,
    };
  }

  async findById(id: string): Promise<InspectionAssignment | null> {
    const rows = await this.baseJoin().where(eq(assignmentsTable.id, id)).limit(1);
    const row = rows[0];
    if (!row) return null;
    return toInspectionAssignment(row);
  }

  async assignWithAuditAndEvent(cmd: AssignInspectorWrite): Promise<InspectionAssignment> {
    return this.db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: assignmentsTable.id })
        .from(assignmentsTable)
        .where(
          and(
            eq(assignmentsTable.inspectionId, cmd.inspectionId),
            eq(assignmentsTable.userId, cmd.userId),
          ),
        )
        .limit(1);
      if (existing[0]) {
        throw new DuplicateAssignmentError("Inspector is already assigned to this inspection.");
      }

      await tx.insert(assignmentsTable).values({
        id: cmd.id,
        inspectionId: cmd.inspectionId,
        userId: cmd.userId,
        role: cmd.role,
      });

      await tx.insert(auditEvents).values({
        action: "inspection.assigned",
        actorUserId: cmd.actorUserId,
        resourceType: "inspection",
        resourceId: cmd.inspectionId,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { inspectorUserId: cmd.userId, role: cmd.role },
      });

      await tx.insert(outboxEvents).values({
        type: "inspection.assigned",
        correlationId: cmd.inspectionId,
        actorUserId: cmd.userId,
        resourceType: "inspection",
        resourceId: cmd.inspectionId,
        payload: {
          inspectionId: cmd.inspectionId,
          userId: cmd.userId,
          role: cmd.role,
        },
      });

      const rows = await tx
        .select({
          id: assignmentsTable.id,
          inspectionId: assignmentsTable.inspectionId,
          userId: assignmentsTable.userId,
          role: assignmentsTable.role,
          assignedAt: assignmentsTable.assignedAt,
          userName: usersTable.displayName,
          inspectionStatus: inspectionsTable.status,
          inspectionType: inspectionsTable.type,
          projectCode: projectsTable.code,
          projectName: projectsTable.name,
          districtId: projectsTable.districtId,
        })
        .from(assignmentsTable)
        .innerJoin(usersTable, eq(assignmentsTable.userId, usersTable.id))
        .innerJoin(inspectionsTable, eq(assignmentsTable.inspectionId, inspectionsTable.id))
        .innerJoin(projectsTable, eq(inspectionsTable.projectId, projectsTable.id))
        .where(eq(assignmentsTable.id, cmd.id))
        .limit(1);
      const assignment = rows[0]!;

      const notificationId = randomUUID();
      await tx.insert(notificationsTable).values({
        id: notificationId,
        userId: cmd.userId,
        type: "inspection.assigned",
        title: "New inspection assignment",
        body: `You have been assigned as ${cmd.role} to ${assignment.projectName} (${assignment.projectCode}).`,
        status: "pending",
      });
      await tx.insert(outboxEvents).values({
        type: "notification.created",
        correlationId: notificationId,
        actorUserId: cmd.userId,
        resourceType: "notification",
        resourceId: notificationId,
        payload: {
          userId: cmd.userId,
          notificationType: "inspection.assigned",
        },
      });

      return toInspectionAssignment(assignment);
    });
  }

  async remove(id: string): Promise<void> {
    await this.db.delete(assignmentsTable).where(eq(assignmentsTable.id, id));
  }
}

export class DuplicateAssignmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateAssignmentError";
  }
}
