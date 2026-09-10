import type { FastifyInstance } from "fastify";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import {
  createReportSchema,
  idParamsSchema,
  reportListQuerySchema,
  reportPageSchema,
  reportSchema,
} from "@netram/validation";
import type { ReportListQuery } from "@netram/types";

export async function registerReportRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  const reportService = container.reportService;
  const paramsSchema = toJsonSchema("ReportIdParams", idParamsSchema);

  app.get(
    "/reports",
    {
      schema: {
        tags: ["reports"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("ReportListQuery", reportListQuerySchema),
        response: { 200: toJsonSchema("ReportPage", reportPageSchema) },
      },
    },
    async (request) => {
      const q = request.query as unknown as ReportListQuery;
      return reportService.listReports(request.netram!, q);
    },
  );

  app.get(
    "/reports/:id",
    {
      schema: {
        tags: ["reports"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: { 200: toJsonSchema("Report", reportSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return reportService.getReport(request.netram!, id);
    },
  );

  app.post(
    "/reports",
    {
      schema: {
        tags: ["reports"],
        security: [{ bearerAuth: [] }],
        body: toJsonSchema("CreateReportBody", createReportSchema),
        response: { 201: toJsonSchema("Report", reportSchema) },
      },
    },
    async (request) => {
      const body = request.body as { inspectionId: string; format?: "json" };
      return reportService.createReport(request.netram!, body);
    },
  );

  app.post(
    "/reports/:id/finalize",
    {
      schema: {
        tags: ["reports"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: { 200: toJsonSchema("Report", reportSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return reportService.finalizeReport(request.netram!, id);
    },
  );
}
