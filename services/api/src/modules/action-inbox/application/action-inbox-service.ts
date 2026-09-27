import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { ProjectService } from "../../projects/application/project-service.js";
import type { FindingService } from "../../findings/application/finding-service.js";
import type { CorrectiveActionService } from "../../corrective-actions/application/corrective-action-service.js";
import type { ComplaintService } from "../../complaints/application/complaint-service.js";
import type { AiAnomalyService } from "../../ai-anomalies/application/ai-anomaly-service.js";
import type { AttendanceService } from "../../attendance/application/attendance-service.js";
import type { ExpenseService } from "../../funds/application/expense-service.js";
import type { FinancialDocumentService } from "../../funds/application/document-service.js";
import type { FinancialRiskService } from "../../financial-risk/application/financial-risk-service.js";
import type {
  ActionInboxItem,
  ActionInboxKind,
  ActionInboxResponse,
  ActionInboxSection,
} from "@netram/types";
import { ACTION_INBOX_PERMISSIONS } from "@netram/types";

/**
 * Per-section fetch signature: each contributing module exposes a
 * jurisdiction-scoped, "awaiting decision" read. The inbox calls it only when
 * the caller holds the gating permission, so no data leaves the server that
 * the caller is not authorised to act on (§34: omitted, not hidden).
 */
type SectionFetcher = (ctx: RequestUserContext) => Promise<ActionInboxItem[]>;

const SECTION_TITLES: Record<ActionInboxKind, string> = {
  project_verification: "Registrations awaiting verification",
  finding_review: "Findings awaiting authority review",
  corrective_action_review: "Action Taken Reports awaiting review",
  complaint_review: "Complaints requiring a decision",
  ai_anomaly_review: "AI alerts awaiting review",
  attendance_anomaly_review: "Attendance anomalies awaiting review",
  attendance_correction_approval: "Attendance corrections awaiting approval",
  expense_verification: "Expenses awaiting verification",
  financial_document_verification: "Financial documents awaiting verification",
  inspection_flag_review: "Risk flags awaiting review",
};

/** Upper bound per section — the inbox is a worklist, not an export. */
const MAX_ITEMS_PER_SECTION = 100;

export interface ActionInboxServiceDeps {
  authz: AuthorizationService;
  projectService: Pick<ProjectService, "listVerificationQueue">;
  findingService: Pick<FindingService, "listFindingsAwaitingOrder">;
  correctiveActionService: Pick<CorrectiveActionService, "listCorrectiveActions">;
  complaintService: Pick<ComplaintService, "listComplaints">;
  aiAnomalyService: Pick<AiAnomalyService, "listAiAnomalies">;
  attendanceService: Pick<AttendanceService, "listAnomalies" | "listPendingCorrections">;
  expenseService: Pick<ExpenseService, "listExpenses">;
  financialDocumentService: Pick<FinancialDocumentService, "listPendingDocuments">;
  financialRiskService: Pick<FinancialRiskService, "listFlags">;
}

export class ActionInboxService {
  private readonly authz: AuthorizationService;
  private readonly fetchers: Partial<Record<ActionInboxKind, SectionFetcher>>;

  constructor(private readonly deps: ActionInboxServiceDeps) {
    this.authz = deps.authz;
    // Arrow wrappers keep `this` bound to the service instance when the
    // fetchers are invoked through the dispatch table below.
    this.fetchers = {
      project_verification: (ctx) => this.fetchProjectVerifications(ctx),
      finding_review: (ctx) => this.fetchFindings(ctx),
      corrective_action_review: (ctx) => this.fetchCorrectiveActions(ctx),
      complaint_review: (ctx) => this.fetchComplaints(ctx),
      ai_anomaly_review: (ctx) => this.fetchAiAnomalies(ctx),
      attendance_anomaly_review: (ctx) => this.fetchAttendanceAnomalies(ctx),
      attendance_correction_approval: (ctx) => this.fetchAttendanceCorrections(ctx),
      expense_verification: (ctx) => this.fetchExpenses(ctx),
      financial_document_verification: (ctx) => this.fetchFinancialDocuments(ctx),
      inspection_flag_review: (ctx) => this.fetchInspectionFlags(ctx),
    };
  }

  /**
   * Assemble the caller's inbox. Each section appears only when the caller
   * holds the permission that authorises the corresponding decision; items are
   * already jurisdiction-scoped by the contributing services.
   */
  async list(ctx: RequestUserContext): Promise<ActionInboxResponse> {
    const kinds = Object.keys(this.fetchers) as ActionInboxKind[];

    const sections = await Promise.all(
      kinds.map(async (kind): Promise<ActionInboxSection | null> => {
        const permission = ACTION_INBOX_PERMISSIONS[kind];
        if (!this.authz.hasPermission(ctx, permission as never)) {
          return null; // §34: do not send sections the caller cannot act on.
        }
        const items = await this.fetchers[kind]!(ctx);
        return {
          kind,
          title: SECTION_TITLES[kind],
          gatedBy: permission,
          items,
          total: items.length,
        };
      }),
    );

    const present = sections.filter((s): s is ActionInboxSection => s !== null);
    return {
      sections: present,
      total: present.reduce((sum, s) => sum + s.total, 0),
      generatedAt: new Date().toISOString(),
    };
  }

  /* ---------- Section fetchers ---------- */

  private async fetchProjectVerifications(ctx: RequestUserContext): Promise<ActionInboxItem[]> {
    const page = await this.deps.projectService.listVerificationQueue(ctx);
    return page.items.slice(0, MAX_ITEMS_PER_SECTION).map((p) => ({
      id: p.id,
      kind: "project_verification" as const,
      title: "Approve facility registration",
      summary: `${p.name} was registered and is awaiting an authority verification decision.`,
      actionType: "approve" as const,
      project: {
        id: p.id,
        code: p.code,
        name: p.name,
        districtId: p.districtId,
      },
      queuedAt: p.createdAt,
      deadline: null,
      severity: null,
      amountInr: null,
      actor: null,
      link: { href: `/dashboard/projects/${p.id}`, label: "Review registration" },
      context: { projectType: p.type },
    }));
  }

  private async fetchFindings(ctx: RequestUserContext): Promise<ActionInboxItem[]> {
    const awaiting = await this.deps.findingService.listFindingsAwaitingOrder(ctx);
    return awaiting.slice(0, MAX_ITEMS_PER_SECTION).map((f) => ({
      id: f.id,
      kind: "finding_review" as const,
      title: "Order remediation for confirmed finding",
      summary: f.description,
      actionType: "review" as const,
      project: {
        id: f.project.id,
        code: f.project.code,
        name: f.project.name,
        districtId: f.project.districtId,
      },
      queuedAt: f.createdAt,
      deadline: null,
      severity: f.severity,
      amountInr: f.amountInr,
      actor: null,
      link: { href: `/dashboard/inspections/${f.inspectionId}`, label: "Open inspection" },
      context: {
        inspectionId: f.inspectionId,
        inspectionStatus: f.inspectionStatus,
        remediation: f.remediation,
        // Default responsible party for the order; matches the finding service's
        // own fallback to the audited facility's operator.
        organisationId: f.project.organisationId,
      },
    }));
  }

  private async fetchCorrectiveActions(ctx: RequestUserContext): Promise<ActionInboxItem[]> {
    // ATRs awaiting review: submitted/under_review, or overdue awaiting a call.
    const page = await this.deps.correctiveActionService.listCorrectiveActions(ctx, {
      page: 1,
      pageSize: MAX_ITEMS_PER_SECTION,
    });
    const reviewable = page.items.filter(
      (a) => a.status === "submitted" || a.status === "under_review" || a.status === "overdue",
    );
    return reviewable.map((a) => ({
      id: a.id,
      kind: "corrective_action_review" as const,
      title: "Review Action Taken Report",
      summary:
        a.actionSummary ??
        `Remediation evidence ${a.status === "overdue" ? "overdue — deadline passed without submission" : "submitted"} for authority review.`,
      actionType: "review" as const,
      project: a.project
        ? {
            id: a.project.id,
            code: a.project.code,
            name: a.project.name,
            districtId: a.project.districtId,
          }
        : { id: null, code: null, name: null, districtId: null },
      queuedAt: a.submittedAt ?? a.updatedAt,
      deadline: a.deadline,
      severity: a.finding?.severity ?? null,
      amountInr: null,
      actor: null,
      link: { href: `/dashboard/corrective-actions/${a.id}`, label: "Open ATR" },
      context: {
        status: a.status,
        findingId: a.findingId,
        actionSummary: a.actionSummary,
        attachmentCount: a.atrFiles.length,
      },
    }));
  }

  private async fetchComplaints(ctx: RequestUserContext): Promise<ActionInboxItem[]> {
    // Received = no authority decision yet; under_review = open decision.
    const page = await this.deps.complaintService.listComplaints(ctx, {
      page: 1,
      pageSize: MAX_ITEMS_PER_SECTION,
    });
    const pending = page.items.filter((c) => c.status === "received" || c.status === "under_review");
    return pending.map((c) => ({
      id: c.id,
      kind: "complaint_review" as const,
      title: "Take up oversight complaint",
      summary: c.description,
      actionType: "review" as const,
      project: {
        id: c.projectId,
        code: c.projectCode,
        name: c.projectName,
        districtId: c.districtId,
      },
      queuedAt: c.receivedAt,
      deadline: null,
      severity: null,
      amountInr: null,
      actor: c.complainantName ? { id: null, name: c.complainantName } : null,
      link: { href: `/dashboard/complaints/${c.id}`, label: "Open complaint" },
      context: {
        status: c.status,
        trackingCode: c.trackingCode,
        attachmentCount: c.files.length,
      },
    }));
  }

  private async fetchAiAnomalies(ctx: RequestUserContext): Promise<ActionInboxItem[]> {
    // AI is advisory (§36): surfaced for review, never auto-actioned.
    const page = await this.deps.aiAnomalyService.listAiAnomalies(ctx, {
      status: "new",
      page: 1,
      pageSize: MAX_ITEMS_PER_SECTION,
    });
    return page.items.map((a) => ({
      id: a.id,
      kind: "ai_anomaly_review" as const,
      title: "Review AI alert",
      summary: a.explanation ?? `${a.type} alert detected on the monitored feed.`,
      actionType: "review" as const,
      project: {
        id: a.projectId,
        code: a.projectCode,
        name: a.projectName,
        districtId: a.districtId,
      },
      queuedAt: a.createdAt,
      deadline: null,
      severity: a.severity,
      amountInr: null,
      actor: null,
      link: { href: "/dashboard/control-room", label: "Open control room" },
      context: {
        inspectionId: a.inspectionId,
        confidence: a.confidence,
        modelVersion: a.modelVersion,
        type: a.type,
      },
    }));
  }

  private async fetchAttendanceAnomalies(ctx: RequestUserContext): Promise<ActionInboxItem[]> {
    const page = await this.deps.attendanceService.listAnomalies(ctx, {
      state: "NEW",
      page: 1,
      pageSize: MAX_ITEMS_PER_SECTION,
    });
    return page.items.map((a) => ({
      id: a.id,
      kind: "attendance_anomaly_review" as const,
      title: "Review attendance anomaly",
      summary: `${a.anomalyType.replace(/_/g, " ").toLowerCase()} flagged${a.projectName ? ` at ${a.projectName}` : ""}.`,
      actionType: "review" as const,
      project: {
        id: a.projectId,
        code: a.projectCode,
        name: a.projectName,
        districtId: a.districtId,
      },
      queuedAt: a.createdAt,
      deadline: null,
      severity: a.severity.toLowerCase(),
      amountInr: null,
      actor: null,
      link: { href: "/dashboard/control-room", label: "Open control room" },
      context: {
        operationalDate: a.operationalDate,
        score: a.score,
        confidence: a.confidence,
        anomalyType: a.anomalyType,
      },
    }));
  }

  private async fetchAttendanceCorrections(ctx: RequestUserContext): Promise<ActionInboxItem[]> {
    const corrections = await this.deps.attendanceService.listPendingCorrections(ctx);
    return corrections.slice(0, MAX_ITEMS_PER_SECTION).map((c) => ({
      id: c.id,
      kind: "attendance_correction_approval" as const,
      title: "Approve attendance correction",
      summary: c.reason,
      actionType: "approve" as const,
      project: {
        id: c.projectId,
        code: c.projectCode,
        name: c.projectName,
        districtId: c.districtId,
      },
      queuedAt: c.createdAt,
      deadline: null,
      severity: null,
      amountInr: null,
      actor: c.requesterName ? { id: c.requestedBy, name: c.requesterName } : null,
      link: { href: "/dashboard/attendance", label: "Open attendance" },
      context: {
        targetType: c.targetType,
        field: c.field,
        originalValue: c.originalValue,
        newValue: c.newValue,
      },
    }));
  }

  private async fetchExpenses(ctx: RequestUserContext): Promise<ActionInboxItem[]> {
    const page = await this.deps.expenseService.listExpenses(ctx, {
      status: "submitted",
      page: 1,
      pageSize: MAX_ITEMS_PER_SECTION,
    });
    // under_review items are also awaiting a verification decision.
    const underReview = await this.deps.expenseService.listExpenses(ctx, {
      status: "under_review",
      page: 1,
      pageSize: MAX_ITEMS_PER_SECTION,
    });
    const items = [...page.items, ...underReview.items];
    return items.map((e) => ({
      id: e.id,
      kind: "expense_verification" as const,
      title: "Verify expenditure",
      summary: `${e.category} — ${e.description}`.trim(),
      actionType: "approve" as const,
      project: {
        id: e.projectId,
        code: null,
        name: null,
        districtId: null,
      },
      queuedAt: e.submittedAt ?? e.createdAt,
      deadline: null,
      severity: null,
      amountInr: Number(e.amount),
      actor: null,
      link: { href: "/dashboard/funds", label: "Open funds workspace" },
      // Self-contained decision: the card's verify-payment popup renders the
      // same vendor/payment detail the funds workspace exposes, so the whole
      // dossier for this decision fits on the inbox page.
      context: {
        status: e.status,
        category: e.category,
        description: e.description,
        vendorName: e.vendorName,
        vendorGstin: e.vendorGstin,
        invoiceNumber: e.invoiceNumber,
        invoiceDate: e.invoiceDate,
        paymentMethod: e.paymentMethod,
        paymentReference: e.paymentReference,
        transactionDate: e.transactionDate,
      },
    }));
  }

  private async fetchFinancialDocuments(ctx: RequestUserContext): Promise<ActionInboxItem[]> {
    const docs = await this.deps.financialDocumentService.listPendingDocuments(ctx);
    return docs.slice(0, MAX_ITEMS_PER_SECTION).map((d) => ({
      id: d.id,
      kind: "financial_document_verification" as const,
      title: "Verify financial document",
      summary: `${d.documentType} — ${d.fileName}`,
      actionType: "approve" as const,
      project: {
        id: d.projectId,
        code: d.projectCode,
        name: d.projectName,
        districtId: d.districtId,
      },
      queuedAt: d.createdAt,
      deadline: null,
      severity: null,
      amountInr: null,
      actor: null,
      link: { href: "/dashboard/funds", label: "Open funds workspace" },
      context: {
        expenseId: d.expenseId,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        sha256Hash: d.sha256Hash,
      },
    }));
  }

  private async fetchInspectionFlags(ctx: RequestUserContext): Promise<ActionInboxItem[]> {
    // open/assigned flags are awaiting an authority review or dispatch call.
    const open = await this.deps.financialRiskService.listFlags(ctx, {
      status: "open",
      page: 1,
      pageSize: MAX_ITEMS_PER_SECTION,
    });
    const assigned = await this.deps.financialRiskService.listFlags(ctx, {
      status: "assigned",
      page: 1,
      pageSize: MAX_ITEMS_PER_SECTION,
    });
    const items = [...open.items, ...assigned.items];
    return items.map((f) => ({
      id: f.id,
      kind: "inspection_flag_review" as const,
      title: "Review risk flag",
      summary: f.explanation,
      actionType: "review" as const,
      project: {
        id: f.projectId,
        code: null,
        name: null,
        districtId: null,
      },
      queuedAt: f.createdAt,
      deadline: null,
      severity: f.riskLevel,
      amountInr: null,
      actor: null,
      link: { href: "/dashboard/funds", label: "Open funds workspace" },
      context: {
        status: f.status,
        riskScore: f.riskScore,
        triggerSource: f.triggerSource,
      },
    }));
  }
}
