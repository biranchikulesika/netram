import { createHash, randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { AppError } from "../../../infrastructure/errors.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { ProjectRepositoryPort } from "../../projects/application/ports/project-repository.js";
import type { ObjectStoragePort } from "../../../infrastructure/object-storage.js";
import type { FinancialDocumentRepository, ExpenseRepository } from "@netram/data";
import type { FinancialDocument, DocumentVerificationStatus } from "@netram/types";

const DOC_UPLOAD = "financial_document:upload" as const;
const DOC_VERIFY = "financial_document:verify" as const;
const EXPENSE_READ = "expense:read" as const;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
  "text/csv",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export interface UploadFinancialDocumentInput {
  projectId: string;
  expenseId?: string | null;
  documentType: string;
  fileName: string;
  mimeType: string;
  data: Buffer;
}

export class FinancialDocumentService {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly projectRepo: Pick<ProjectRepositoryPort, "findById">,
    private readonly expenseRepo: ExpenseRepository,
    private readonly docRepo: FinancialDocumentRepository,
    private readonly storage: ObjectStoragePort,
  ) {}

  async uploadDocument(
    ctx: RequestUserContext,
    input: UploadFinancialDocumentInput,
  ): Promise<FinancialDocument> {
    const cleanMime = (input.mimeType || "application/octet-stream")
      .toLowerCase()
      .trim()
      .replace(/[\r\n]/g, "");

    if (!ALLOWED_MIME_TYPES.has(cleanMime)) {
      throw AppError.badRequest(
        `Unsupported document format '${cleanMime}'. Only PDF, image, and office documents are accepted.`,
      );
    }

    const project = await this.projectRepo.findById(input.projectId);
    if (!project) throw AppError.notFound("Project not found");
    this.authz.requirePermission(ctx, DOC_UPLOAD, { districtId: project.districtId });

    if (input.expenseId) {
      const expense = await this.expenseRepo.findById(input.expenseId);
      if (!expense) throw AppError.notFound("Expense not found");
      if (expense.projectId !== input.projectId) {
        throw AppError.badRequest("Expense does not belong to specified project");
      }
      if (expense.status === "verified") {
        throw AppError.conflict("Cannot attach documents to a verified expense");
      }
    }

    // Compute SHA-256 integrity hash
    const sha256Hash = createHash("sha256").update(input.data).digest("hex");

    // Check for byte-identical duplicate
    const existingDuplicate = await this.docRepo.findByHash(sha256Hash);

    const storageKey = `financial-docs/${input.projectId}/${randomUUID()}-${input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    await this.storage.put(storageKey, input.data, input.mimeType);

    return this.docRepo.createWithAudit({
      projectId: input.projectId,
      expenseId: input.expenseId ?? null,
      documentType: input.documentType,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.data.length,
      sha256Hash,
      storageKey,
      duplicateOfId: existingDuplicate ? existingDuplicate.id : null,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction: "financial_document.uploaded",
      auditMetadata: {
        projectId: input.projectId,
        expenseId: input.expenseId,
        fileName: input.fileName,
        sha256Hash,
        isDuplicate: Boolean(existingDuplicate),
      },
      eventType: "financial_document.uploaded",
      eventPayload: {
        projectId: input.projectId,
        fileName: input.fileName,
        sha256Hash,
      },
    });
  }

  /**
   * Documents awaiting verification across the caller's jurisdiction, for the
   * Action Inbox. Gated by the verify permission (AGENTS.md §16).
   */
  async listPendingDocuments(ctx: RequestUserContext) {
    this.authz.requirePermission(ctx, DOC_VERIFY);
    const scope = this.authz.accessibleDistrictIds(ctx);
    return this.docRepo.listPending(scope ? [...scope] : undefined);
  }

  async getDocument(ctx: RequestUserContext, id: string): Promise<FinancialDocument> {
    const doc = await this.docRepo.findById(id);
    if (!doc) throw AppError.notFound("Financial document not found");

    const project = await this.projectRepo.findById(doc.projectId);
    this.authz.requirePermission(ctx, EXPENSE_READ, { districtId: project?.districtId });
    return doc;
  }

  async downloadDocument(
    ctx: RequestUserContext,
    id: string,
  ): Promise<{ stream: Readable; document: FinancialDocument }> {
    const document = await this.getDocument(ctx, id);
    const stream = await this.storage.get(document.storageKey);
    return { stream, document };
  }

  async listDocumentsByExpense(
    ctx: RequestUserContext,
    expenseId: string,
  ): Promise<FinancialDocument[]> {
    const expense = await this.expenseRepo.findById(expenseId);
    if (!expense) throw AppError.notFound("Expense not found");

    const project = await this.projectRepo.findById(expense.projectId);
    this.authz.requirePermission(ctx, EXPENSE_READ, { districtId: project?.districtId });
    return this.docRepo.listByExpense(expenseId);
  }

  async verifyDocument(
    ctx: RequestUserContext,
    id: string,
    status: DocumentVerificationStatus,
    rejectionReason?: string,
  ): Promise<FinancialDocument> {
    const doc = await this.getDocument(ctx, id);
    const project = await this.projectRepo.findById(doc.projectId);
    this.authz.requirePermission(ctx, DOC_VERIFY, { districtId: project?.districtId });

    // Enforce separation of duties: Institutions/agencies cannot verify financial documents
    const isInstitution = ctx.assignments.some((a) => a.roleCode === "institution_admin");
    if (isInstitution) {
      throw AppError.forbidden(
        "Institutions/agencies cannot verify financial documents. Verification must be performed by an Authorized Officer or Auditor.",
      );
    }

    // Prohibit self-verification (maker-checker rule)
    if (doc.uploadedById && doc.uploadedById === ctx.userId) {
      throw AppError.forbidden(
        "Self-verification is prohibited. The officer verifying a document cannot be the user who uploaded it.",
      );
    }

    return this.docRepo.updateStatusWithAudit({
      id,
      verificationStatus: status,
      verifiedById: ctx.userId,
      verifiedAt: new Date(),
      rejectionReason: rejectionReason ?? null,
      actorUserId: ctx.userId,
      requestId: ctx.requestId ?? null,
      ipAddress: ctx.ipAddress ?? null,
      auditAction:
        status === "rejected" ? "financial_document.rejected" : "financial_document.verified",
      auditMetadata: {
        documentId: id,
        status,
        rejectionReason,
      },
      eventType:
        status === "rejected" ? "financial_document.rejected" : "financial_document.verified",
      eventPayload: {
        documentId: id,
        status,
      },
    });
  }
}
