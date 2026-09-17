import { and, eq, inArray } from "drizzle-orm";
import {
  districts as districtsTable,
  projects as projectsTable,
  inspections as inspectionsTable,
  findings as findingsTable,
  correctiveActions as correctiveActionsTable,
  complaints as complaintsTable,
} from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type {
  AuthorityAnalyticsOverview,
  AuthorityAnalyticsSummary,
  DeficiencyRecurrence,
  InspectionClosureVelocity,
  InspectionClosureVelocityByJurisdiction,
  SlaComplianceByJurisdiction,
  UUID,
} from "@netram/types";

export interface AnalyticsRepositoryFilter {
  accessibleDistrictIds?: Set<string> | null;
  filterDistrictId?: string;
  fromDate?: Date;
  toDate?: Date;
}

function categorizeFinding(description: string): string {
  const text = description.toLowerCase();
  if (/fire|extinguisher|electrical|wiring|hazard|smoke|circuit|breaker|emergency exit/.test(text)) {
    return "Fire & Electrical Safety";
  }
  if (/sanitation|toilet|drainage|water|hygiene|clean|waste|washroom|septic/.test(text)) {
    return "Sanitation & Water Hygiene";
  }
  if (/wall|roof|crack|structural|civil|ceiling|plaster|foundation|floor|window|door/.test(text)) {
    return "Structural & Civil Maintenance";
  }
  if (/attendance|staff|roster|biometric|absent|doctor|nurse|warden|duty|cook/.test(text)) {
    return "Staffing & Roster Compliance";
  }
  if (/food|kitchen|ration|meal|nutrition|pantry|diet|dining|storage/.test(text)) {
    return "Nutrition & Kitchen Standards";
  }
  return "Statutory & Administrative Compliance";
}

export class AnalyticsRepository {
  constructor(private db: DrizzleDB) {}

  async getAuthorityAnalytics(filter: AnalyticsRepositoryFilter): Promise<AuthorityAnalyticsOverview> {
    const now = new Date();

    // 1. Resolve active district scope
    let activeScope: string[] | undefined = undefined;
    if (filter.filterDistrictId) {
      if (filter.accessibleDistrictIds && !filter.accessibleDistrictIds.has(filter.filterDistrictId)) {
        activeScope = ["00000000-0000-0000-0000-000000000000"]; // Empty result for unauthorized scope
      } else {
        activeScope = [filter.filterDistrictId];
      }
    } else if (filter.accessibleDistrictIds !== null && filter.accessibleDistrictIds !== undefined) {
      activeScope = Array.from(filter.accessibleDistrictIds);
      if (activeScope.length === 0) {
        activeScope = ["00000000-0000-0000-0000-000000000000"];
      }
    }

    const projectScope = activeScope?.length ? inArray(projectsTable.districtId, activeScope) : undefined;

    // 2. Fetch relevant districts
    const districtConditions = activeScope?.length ? [inArray(districtsTable.id, activeScope)] : [];
    const districtRows = await this.db
      .select({
        id: districtsTable.id,
        name: districtsTable.name,
        code: districtsTable.code,
      })
      .from(districtsTable)
      .where(and(...districtConditions));

    const districtMap = new Map<string, { name: string; code: string }>();
    for (const d of districtRows) {
      districtMap.set(d.id, { name: d.name, code: d.code });
    }

    // 3. Query Projects
    const projectRows = await this.db
      .select({
        id: projectsTable.id,
        status: projectsTable.status,
        districtId: projectsTable.districtId,
      })
      .from(projectsTable)
      .where(projectScope);

    const totalProjects = projectRows.length;
    const activeProjects = projectRows.filter((p) => p.status === "Active").length;

    // 4. Query Inspections
    const inspectionRows = await this.db
      .select({
        id: inspectionsTable.id,
        status: inspectionsTable.status,
        scheduledStart: inspectionsTable.scheduledStart,
        startedAt: inspectionsTable.startedAt,
        submittedAt: inspectionsTable.submittedAt,
        createdAt: inspectionsTable.createdAt,
        updatedAt: inspectionsTable.updatedAt,
        districtId: projectsTable.districtId,
      })
      .from(inspectionsTable)
      .innerJoin(projectsTable, eq(inspectionsTable.projectId, projectsTable.id))
      .where(projectScope);

    const totalInspections = inspectionRows.length;
    const closedInspections = inspectionRows.filter((i) => i.status === "closed").length;
    const inProgressInspections = inspectionRows.filter((i) =>
      ["in_progress", "evidence_collection", "scheduled"].includes(i.status),
    ).length;
    const underReviewInspections = inspectionRows.filter((i) =>
      ["submitted", "under_review", "findings", "corrective_actions", "verification"].includes(i.status),
    ).length;

    // Calculate closure velocity
    let totalClosureDurationDays = 0;
    let closedWithDurationCount = 0;
    const districtVelocityMap = new Map<
      string,
      { total: number; closed: number; totalDurationDays: number }
    >();

    // Initialize map for all queried districts
    for (const d of districtRows) {
      districtVelocityMap.set(d.id, { total: 0, closed: 0, totalDurationDays: 0 });
    }

    for (const insp of inspectionRows) {
      const distId = insp.districtId;
      if (distId && !districtVelocityMap.has(distId)) {
        districtVelocityMap.set(distId, { total: 0, closed: 0, totalDurationDays: 0 });
      }

      const distStat = distId ? districtVelocityMap.get(distId) : undefined;
      if (distStat) distStat.total += 1;

      if (insp.status === "closed") {
        const start = insp.startedAt ?? insp.scheduledStart ?? insp.createdAt;
        const end = insp.updatedAt ?? now;
        const durationDays = Math.max(0.1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        totalClosureDurationDays += durationDays;
        closedWithDurationCount += 1;

        if (distStat) {
          distStat.closed += 1;
          distStat.totalDurationDays += durationDays;
        }
      }
    }

    const averageClosureDays =
      closedWithDurationCount > 0
        ? Math.round((totalClosureDurationDays / closedWithDurationCount) * 10) / 10
        : 0;

    const velocityByJurisdiction: InspectionClosureVelocityByJurisdiction[] = [];
    for (const [distId, stats] of districtVelocityMap.entries()) {
      const dInfo = districtMap.get(distId);
      const avgDays =
        stats.closed > 0 ? Math.round((stats.totalDurationDays / stats.closed) * 10) / 10 : 0;
      velocityByJurisdiction.push({
        districtId: distId as UUID,
        districtName: dInfo?.name ?? "Unknown District",
        totalInspections: stats.total,
        closedInspections: stats.closed,
        averageClosureDays: avgDays,
      });
    }

    const inspectionClosureVelocity: InspectionClosureVelocity = {
      totalInspections,
      closedInspections,
      inProgressInspections,
      underReviewInspections,
      averageClosureDays,
      velocityByJurisdiction,
    };

    // 5. Query Findings & Deficiency Recurrence
    const findingRows = await this.db
      .select({
        id: findingsTable.id,
        severity: findingsTable.severity,
        description: findingsTable.description,
        status: findingsTable.status,
        districtId: projectsTable.districtId,
      })
      .from(findingsTable)
      .innerJoin(inspectionsTable, eq(findingsTable.inspectionId, inspectionsTable.id))
      .innerJoin(projectsTable, eq(inspectionsTable.projectId, projectsTable.id))
      .where(projectScope);

    const totalFindings = findingRows.length;
    let criticalFindingsCount = 0;

    const categoryMap = new Map<
      string,
      {
        total: number;
        critical: number;
        high: number;
        medium: number;
        low: number;
        unresolved: number;
        resolved: number;
      }
    >();

    const standardCategories = [
      "Fire & Electrical Safety",
      "Sanitation & Water Hygiene",
      "Structural & Civil Maintenance",
      "Staffing & Roster Compliance",
      "Nutrition & Kitchen Standards",
      "Statutory & Administrative Compliance",
    ];

    for (const cat of standardCategories) {
      categoryMap.set(cat, {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        unresolved: 0,
        resolved: 0,
      });
    }

    for (const f of findingRows) {
      const cat = categorizeFinding(f.description);
      let entry = categoryMap.get(cat);
      if (!entry) {
        entry = {
          total: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          unresolved: 0,
          resolved: 0,
        };
        categoryMap.set(cat, entry);
      }

      entry.total += 1;
      const sev = f.severity?.toLowerCase();
      if (sev === "critical") {
        entry.critical += 1;
        criticalFindingsCount += 1;
      } else if (sev === "high") {
        entry.high += 1;
      } else if (sev === "medium") {
        entry.medium += 1;
      } else {
        entry.low += 1;
      }

      if (f.status === "closed") {
        entry.resolved += 1;
      } else {
        entry.unresolved += 1;
      }
    }

    const deficiencyRecurrence: DeficiencyRecurrence[] = Array.from(categoryMap.entries())
      .map(([category, stats]) => ({
        category,
        totalOccurrences: stats.total,
        severityBreakdown: {
          critical: stats.critical,
          high: stats.high,
          medium: stats.medium,
          low: stats.low,
        },
        unresolvedCount: stats.unresolved,
        resolvedCount: stats.resolved,
      }))
      .sort((a, b) => b.totalOccurrences - a.totalOccurrences);

    // 6. Query Corrective Actions & SLA Compliance
    const caRows = await this.db
      .select({
        id: correctiveActionsTable.id,
        status: correctiveActionsTable.status,
        deadline: correctiveActionsTable.deadline,
        submittedAt: correctiveActionsTable.submittedAt,
        districtId: projectsTable.districtId,
      })
      .from(correctiveActionsTable)
      .innerJoin(inspectionsTable, eq(correctiveActionsTable.inspectionId, inspectionsTable.id))
      .innerJoin(projectsTable, eq(inspectionsTable.projectId, projectsTable.id))
      .where(projectScope);

    const totalCorrectiveActions = caRows.length;
    let resolvedCorrectiveActions = 0;
    let overdueCorrectiveActions = 0;

    const districtCaMap = new Map<
      string,
      {
        total: number;
        pending: number;
        submitted: number;
        accepted: number;
        overdue: number;
      }
    >();

    for (const d of districtRows) {
      districtCaMap.set(d.id, {
        total: 0,
        pending: 0,
        submitted: 0,
        accepted: 0,
        overdue: 0,
      });
    }

    for (const ca of caRows) {
      const distId = ca.districtId;
      if (distId && !districtCaMap.has(distId)) {
        districtCaMap.set(distId, {
          total: 0,
          pending: 0,
          submitted: 0,
          accepted: 0,
          overdue: 0,
        });
      }
      const distEntry = distId ? districtCaMap.get(distId) : undefined;
      if (distEntry) distEntry.total += 1;

      const isOverdue =
        ca.status === "overdue" ||
        ((ca.status === "pending" || ca.status === "submitted" || ca.status === "under_review") &&
          ca.deadline &&
          new Date(ca.deadline).getTime() < now.getTime());

      if (isOverdue) {
        overdueCorrectiveActions += 1;
        if (distEntry) distEntry.overdue += 1;
      } else if (ca.status === "accepted") {
        resolvedCorrectiveActions += 1;
        if (distEntry) distEntry.accepted += 1;
      } else if (ca.status === "submitted" || ca.status === "under_review") {
        if (distEntry) distEntry.submitted += 1;
      } else {
        if (distEntry) distEntry.pending += 1;
      }
    }

    const overallSlaComplianceRate =
      totalCorrectiveActions > 0
        ? Math.max(
            0,
            Math.round(
              ((totalCorrectiveActions - overdueCorrectiveActions) / totalCorrectiveActions) * 1000,
            ) / 10,
          )
        : 100;

    const slaComplianceByJurisdiction: SlaComplianceByJurisdiction[] = [];
    for (const [distId, stats] of districtCaMap.entries()) {
      const dInfo = districtMap.get(distId);
      const compliance =
        stats.total > 0
          ? Math.max(
              0,
              Math.round(((stats.total - stats.overdue) / stats.total) * 1000) / 10,
            )
          : 100;

      slaComplianceByJurisdiction.push({
        districtId: distId as UUID,
        districtName: dInfo?.name ?? "Unknown District",
        districtCode: dInfo?.code ?? "UNK",
        totalActions: stats.total,
        pendingActions: stats.pending,
        submittedActions: stats.submitted,
        acceptedActions: stats.accepted,
        overdueActions: stats.overdue,
        slaComplianceRate: compliance,
      });
    }

    // 7. Query Complaints & Redressal Rate
    const complaintRows = await this.db
      .select({
        id: complaintsTable.id,
        status: complaintsTable.status,
        districtId: projectsTable.districtId,
      })
      .from(complaintsTable)
      .innerJoin(projectsTable, eq(complaintsTable.projectId, projectsTable.id))
      .where(projectScope);

    const totalComplaints = complaintRows.length;
    const resolvedComplaints = complaintRows.filter((c) =>
      ["resolved", "closed"].includes(c.status),
    ).length;
    const complaintRedressalRate =
      totalComplaints > 0
        ? Math.round((resolvedComplaints / totalComplaints) * 1000) / 10
        : 100;

    const summary: AuthorityAnalyticsSummary = {
      totalProjects,
      activeProjects,
      totalInspections,
      closedInspections,
      averageClosureDays,
      totalCorrectiveActions,
      resolvedCorrectiveActions,
      overdueCorrectiveActions,
      overallSlaComplianceRate,
      totalComplaints,
      resolvedComplaints,
      complaintRedressalRate,
      totalFindings,
      criticalFindingsCount,
    };

    return {
      summary,
      slaComplianceByJurisdiction,
      deficiencyRecurrence,
      inspectionClosureVelocity,
      generatedAt: now.toISOString(),
    };
  }
}
