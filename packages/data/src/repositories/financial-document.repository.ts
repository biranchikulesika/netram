import { desc, eq } from "drizzle-orm";
import {
  financialDocuments as documentsTable,
  auditEvents,
  outboxEvents,
} from "../db/schema.js";
import type { DrizzleDB } from "../db/client.js";
import type {
  FinancialDocument,
  DocumentVerificationStatus,
  AuditAction,
  DomainEventType,
} from "@netram/types";

export interface FinancialDocumentRow {
  id: string;
  expenseId: string | null;
  projectId: string;
  documentType: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
  storageKey: string;
  verificationStatus: DocumentVerificationStatus;
  uploadedById: string | null;
  uploadedAt: Date;
  verifiedById: string | null;
  verifiedAt: Date | null;
  rejectionReason: string | null;
  duplicateOfId: string | null;
  createdAt: Date;
}

export function toFinancialDocument(row: FinancialDocumentRow): FinancialDocument {
  return {
    id: row.id,
    expenseId: row.expenseId,
    projectId: row.projectId,
    documentType: row.documentType,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    sha256Hash: row.sha256Hash,
    storageKey: row.storageKey,
    verificationStatus: row.verificationStatus,
    uploadedById: row.uploadedById,
    uploadedAt: row.uploadedAt.toISOString(),
    verifiedById: row.verifiedById,
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
    rejectionReason: row.rejectionReason,
    duplicateOfId: row.duplicateOfId,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface DocumentWriteContext {
  actorUserId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  auditAction: AuditAction;
  auditMetadata: Record<string, unknown>;
  eventType: DomainEventType;
  eventPayload: Record<string, unknown>;
}

export interface CreateDocumentWrite extends DocumentWriteContext {
  id?: string;
  expenseId?: string | null;
  projectId: string;
  documentType: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
  storageKey: string;
  duplicateOfId?: string | null;
}

export interface UpdateDocumentStatusWrite extends DocumentWriteContext {
  id: string;
  verificationStatus: DocumentVerificationStatus;
  verifiedById?: string | null;
  verifiedAt?: Date | null;
  rejectionReason?: string | null;
}

export class FinancialDocumentRepository {
  constructor(private db: DrizzleDB) {}

  async listByExpense(expenseId: string): Promise<FinancialDocument[]> {
    const rows = await this.db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.expenseId, expenseId))
      .orderBy(desc(documentsTable.createdAt));
    return rows.map((r) => toFinancialDocument(r as unknown as FinancialDocumentRow));
  }

  async listByProject(projectId: string): Promise<FinancialDocument[]> {
    const rows = await this.db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.projectId, projectId))
      .orderBy(desc(documentsTable.createdAt));
    return rows.map((r) => toFinancialDocument(r as unknown as FinancialDocumentRow));
  }

  async findById(id: string): Promise<FinancialDocument | null> {
    const rows = await this.db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.id, id))
      .limit(1);
    if (!rows[0]) return null;
    return toFinancialDocument(rows[0] as unknown as FinancialDocumentRow);
  }

  async findByHash(sha256Hash: string): Promise<FinancialDocument | null> {
    const rows = await this.db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.sha256Hash, sha256Hash))
      .limit(1);
    if (!rows[0]) return null;
    return toFinancialDocument(rows[0] as unknown as FinancialDocumentRow);
  }

  async createWithAudit(cmd: CreateDocumentWrite): Promise<FinancialDocument> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .insert(documentsTable)
        .values({
          id: cmd.id,
          expenseId: cmd.expenseId,
          projectId: cmd.projectId,
          documentType: cmd.documentType,
          fileName: cmd.fileName,
          mimeType: cmd.mimeType,
          sizeBytes: cmd.sizeBytes,
          sha256Hash: cmd.sha256Hash,
          storageKey: cmd.storageKey,
          verificationStatus: "pending",
          uploadedById: cmd.actorUserId,
          duplicateOfId: cmd.duplicateOfId,
        })
        .returning();

      const created = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "financial_document",
        resourceId: created.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: created.id,
        actorUserId: cmd.actorUserId,
        resourceType: "financial_document",
        resourceId: created.id,
        payload: {
          ...cmd.eventPayload,
          documentId: created.id,
          projectId: cmd.projectId,
          expenseId: cmd.expenseId,
          fileName: cmd.fileName,
          sha256Hash: cmd.sha256Hash,
        },
      });

      return toFinancialDocument(created as unknown as FinancialDocumentRow);
    });
  }

  async updateStatusWithAudit(cmd: UpdateDocumentStatusWrite): Promise<FinancialDocument> {
    return this.db.transaction(async (tx) => {
      const patch: Record<string, unknown> = {
        verificationStatus: cmd.verificationStatus,
      };
      if (cmd.verifiedById !== undefined) patch.verifiedById = cmd.verifiedById;
      if (cmd.verifiedAt !== undefined) patch.verifiedAt = cmd.verifiedAt;
      if (cmd.rejectionReason !== undefined) patch.rejectionReason = cmd.rejectionReason;

      const rows = await tx
        .update(documentsTable)
        .set(patch)
        .where(eq(documentsTable.id, cmd.id))
        .returning();

      const updated = rows[0]!;

      await tx.insert(auditEvents).values({
        action: cmd.auditAction,
        actorUserId: cmd.actorUserId,
        resourceType: "financial_document",
        resourceId: updated.id,
        requestId: cmd.requestId,
        ipAddress: cmd.ipAddress,
        metadata: { ...cmd.auditMetadata },
      });

      await tx.insert(outboxEvents).values({
        type: cmd.eventType,
        correlationId: updated.id,
        actorUserId: cmd.actorUserId,
        resourceType: "financial_document",
        resourceId: updated.id,
        payload: {
          ...cmd.eventPayload,
          documentId: updated.id,
          verificationStatus: cmd.verificationStatus,
        },
      });

      return toFinancialDocument(updated as unknown as FinancialDocumentRow);
    });
  }
}
