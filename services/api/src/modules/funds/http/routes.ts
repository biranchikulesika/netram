import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import { AppError } from "../../../infrastructure/errors.js";
import {
  idParamsSchema,
  createAllocationSchema,
  updateAllocationSchema,
  createReleaseSchema,
  createExpenseSchema,
  patchExpenseSchema,
  rejectExpenseSchema,
  voidExpenseSchema,
  verifyDocumentSchema,
  allocationListQuerySchema,
  expenseListQuerySchema,
} from "@netram/validation";
import type {
  AllocationListQuery,
  ExpenseListQuery,
  DocumentVerificationStatus,
} from "@netram/types";

type MultipartFieldValue = unknown;

function multipartStringValue(value: MultipartFieldValue): string | undefined {
  if (value && typeof value === "object" && "value" in value) {
    const v = (value as { value: unknown }).value;
    return typeof v === "string" ? v : undefined;
  }
  return typeof value === "string" ? value : undefined;
}

function readMultipartFields(fields: Record<string, MultipartFieldValue>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    const s = Array.isArray(value)
      ? (value.map(multipartStringValue).find((x) => x !== undefined) ?? undefined)
      : multipartStringValue(value);
    if (s !== undefined) out[key] = s;
  }
  return out;
}

export async function registerFundRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  const fundService = container.fundService;
  const expenseService = container.expenseService;
  const documentService = container.financialDocumentService;
  const paramsSchema = toJsonSchema("IdParams", idParamsSchema);

  /* ---------- Allocations ---------- */

  app.get(
    "/funds/allocations",
    {
      schema: {
        tags: ["funds"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("AllocationListQuery", allocationListQuerySchema),
      },
    },
    async (request) => {
      const query = request.query as unknown as AllocationListQuery;
      return fundService.listAllocations(request.netram!, query);
    },
  );

  app.post(
    "/funds/allocations",
    {
      schema: {
        tags: ["funds"],
        security: [{ bearerAuth: [] }],
        body: toJsonSchema("CreateAllocationBody", createAllocationSchema),
      },
    },
    async (request, reply) => {
      const body = request.body as z.infer<typeof createAllocationSchema>;
      const allocation = await fundService.createAllocation(request.netram!, body);
      void reply.code(201);
      return allocation;
    },
  );

  app.get(
    "/funds/allocations/:id",
    {
      schema: {
        tags: ["funds"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return fundService.getAllocation(request.netram!, id);
    },
  );

  app.patch(
    "/funds/allocations/:id",
    {
      schema: {
        tags: ["funds"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("UpdateAllocationBody", updateAllocationSchema),
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof updateAllocationSchema>;
      return fundService.updateAllocation(request.netram!, id, body);
    },
  );

  /* ---------- Releases ---------- */

  app.get(
    "/funds/allocations/:id/releases",
    {
      schema: {
        tags: ["funds"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return fundService.listReleases(request.netram!, id);
    },
  );

  app.post(
    "/funds/releases",
    {
      schema: {
        tags: ["funds"],
        security: [{ bearerAuth: [] }],
        body: toJsonSchema("CreateReleaseBody", createReleaseSchema),
      },
    },
    async (request, reply) => {
      const body = request.body as z.infer<typeof createReleaseSchema>;
      const release = await fundService.createRelease(request.netram!, body);
      void reply.code(201);
      return release;
    },
  );

  app.post(
    "/funds/releases/:id/reverse",
    {
      schema: {
        tags: ["funds"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema(
          "ReverseReleaseBody",
          z.object({ remarks: z.string().optional() }),
        ),
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as { remarks?: string };
      return fundService.reverseRelease(request.netram!, id, body.remarks);
    },
  );

  /* ---------- Project Overview / Summary ---------- */

  app.get(
    "/funds/projects/:id/summary",
    {
      schema: {
        tags: ["funds"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return fundService.getProjectSummary(request.netram!, id);
    },
  );

  app.get(
    "/funds/projects/:id/overview",
    {
      schema: {
        tags: ["funds"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return fundService.getProjectOverview(request.netram!, id);
    },
  );

  /* ---------- Expenses ---------- */

  app.get(
    "/funds/expenses",
    {
      schema: {
        tags: ["expenses"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("ExpenseListQuery", expenseListQuerySchema),
      },
    },
    async (request) => {
      const query = request.query as unknown as ExpenseListQuery;
      return expenseService.listExpenses(request.netram!, query);
    },
  );

  app.post(
    "/funds/expenses",
    {
      schema: {
        tags: ["expenses"],
        security: [{ bearerAuth: [] }],
        body: toJsonSchema("CreateExpenseBody", createExpenseSchema),
      },
    },
    async (request, reply) => {
      const body = request.body as z.infer<typeof createExpenseSchema>;
      const expense = await expenseService.createExpense(request.netram!, body);
      void reply.code(201);
      return expense;
    },
  );

  app.get(
    "/funds/expenses/:id",
    {
      schema: {
        tags: ["expenses"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return expenseService.getExpense(request.netram!, id);
    },
  );

  app.patch(
    "/funds/expenses/:id",
    {
      schema: {
        tags: ["expenses"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("PatchExpenseBody", patchExpenseSchema),
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof patchExpenseSchema>;
      return expenseService.updateExpense(request.netram!, id, body);
    },
  );

  app.post(
    "/funds/expenses/:id/submit",
    {
      schema: {
        tags: ["expenses"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return expenseService.submitExpense(request.netram!, id);
    },
  );

  app.post(
    "/funds/expenses/:id/verify",
    {
      schema: {
        tags: ["expenses"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return expenseService.verifyExpense(request.netram!, id);
    },
  );

  app.post(
    "/funds/expenses/:id/reject",
    {
      schema: {
        tags: ["expenses"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("RejectExpenseBody", rejectExpenseSchema),
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof rejectExpenseSchema>;
      return expenseService.rejectExpense(request.netram!, id, body.reason);
    },
  );

  app.post(
    "/funds/expenses/:id/void",
    {
      schema: {
        tags: ["expenses"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("VoidExpenseBody", voidExpenseSchema),
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof voidExpenseSchema>;
      return expenseService.voidExpense(request.netram!, id, body.voidReason);
    },
  );

  /* ---------- Documents ---------- */

  app.post(
    "/funds/documents/upload",
    {
      schema: {
        tags: ["financial-documents"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const file = await request.file();
      if (!file) throw AppError.badRequest("Multipart upload requires a file part");

      const fields = readMultipartFields(file.fields);
      const projectId = fields.projectId;
      const documentType = fields.documentType ?? "invoice";
      const expenseId = fields.expenseId;

      if (!projectId) throw AppError.badRequest("projectId is required");

      const data = await file.toBuffer();
      const document = await documentService.uploadDocument(request.netram!, {
        projectId,
        expenseId,
        documentType,
        fileName: file.filename || "document",
        mimeType: file.mimetype || "application/octet-stream",
        data,
      });

      void reply.code(201);
      return document;
    },
  );

  app.get(
    "/funds/documents/:id",
    {
      schema: {
        tags: ["financial-documents"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return documentService.getDocument(request.netram!, id);
    },
  );

  app.get(
    "/funds/documents/:id/download",
    {
      schema: {
        tags: ["financial-documents"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { stream, document } = await documentService.downloadDocument(request.netram!, id);

      const safeMimeType = (document.mimeType || "application/octet-stream").replace(/[\r\n]/g, "");
      const safeFileName = document.fileName.replace(/["\r\n\\]/g, "_");

      void reply.header("Content-Type", safeMimeType);
      void reply.header("X-Content-Type-Options", "nosniff");
      void reply.header(
        "Content-Disposition",
        `attachment; filename="${safeFileName}"`,
      );
      return reply.send(stream);
    },
  );

  app.get(
    "/funds/expenses/:id/documents",
    {
      schema: {
        tags: ["financial-documents"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return documentService.listDocumentsByExpense(request.netram!, id);
    },
  );

  app.post(
    "/funds/documents/:id/verify",
    {
      schema: {
        tags: ["financial-documents"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("VerifyDocumentBody", verifyDocumentSchema),
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof verifyDocumentSchema>;
      return documentService.verifyDocument(
        request.netram!,
        id,
        body.status as DocumentVerificationStatus,
        body.rejectionReason,
      );
    },
  );
}
