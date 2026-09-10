import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import {
  anomalyPageSchema,
  attendanceAnomalyQuerySchema,
  attendanceAnomalyReviewSchema,
  attendanceCalculationQuerySchema,
  attendanceConfigUpdateSchema,
  attendanceCorrectionApprovalSchema,
  attendanceCorrectionSchema,
  attendanceDrillDownQuerySchema,
  attendanceExportQuerySchema,
  attendanceOverviewQuerySchema,
  calculationPageSchema,
  configSchema,
  correctionSchema,
  drillDownRowSchema,
  exportSchema,
  idParamsSchema,
  recordSourceObservationSchema,
  sourceObservationSchema,
  syncDeviceEventsSchema,
  uuidSchema,
} from "@netram/validation";
import type {
  AttendanceAnomalyReviewInput,
  AttendanceCorrectionInput,
  AttendanceExportQuery,
  AttendanceOverviewQuery,
} from "@netram/types";

export async function registerAttendanceRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  const svc = container.attendanceService;
  const paramsSchema = toJsonSchema("AttendanceIdParams", idParamsSchema);

  /* ---------- Monitoring: aggregate-first (§36) ---------- */

  app.get(
    "/attendance/overview",
    {
      schema: {
        tags: ["attendance"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("AttendanceOverviewQuery", attendanceOverviewQuerySchema),
      },
    },
    async (request) => {
      const q = request.query as unknown as AttendanceOverviewQuery;
      return svc.listOverview(request.netram!, {
        from: q.from,
        to: q.to,
        page: q.page,
        pageSize: q.pageSize,
      });
    },
  );

  app.get(
    "/attendance/calculations",
    {
      schema: {
        tags: ["attendance"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("AttendanceCalculationQuery", attendanceCalculationQuerySchema),
        response: { 200: toJsonSchema("AttendanceCalculationPage", calculationPageSchema) },
      },
    },
    async (request) => {
      const q = request.query as unknown as {
        projectId?: string;
        windowId?: string;
        from?: string;
        to?: string;
        page?: number;
        pageSize?: number;
      };
      return svc.listCalculations(request.netram!, {
        projectId: q.projectId,
        windowId: q.windowId,
        from: q.from,
        to: q.to,
        page: q.page,
        pageSize: q.pageSize,
      });
    },
  );

  app.get(
    "/attendance/devices",
    {
      schema: {
        tags: ["attendance"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema(
          "AttendanceDeviceQuery",
          uuidSchema.optional().describe("projectId"),
        ),
      },
    },
    async (request) => {
      const { projectId } = request.query as { projectId?: string };
      return svc.listDevices(request.netram!, projectId);
    },
  );

  app.get(
    "/attendance/windows",
    {
      schema: {
        tags: ["attendance"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("AttendanceWindowsQuery", uuidSchema.describe("projectId")),
      },
    },
    async (request) => {
      const { projectId } = request.query as { projectId: string };
      return svc.listWindows(request.netram!, projectId);
    },
  );

  app.get(
    "/attendance/observations",
    {
      schema: {
        tags: ["attendance"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema(
          "AttendanceObservationsQuery",
          attendanceOverviewQuerySchema,
        ),
      },
    },
    async (request) => {
      const q = request.query as unknown as { projectId: string; from?: string; to?: string };
      return svc.listSourceObservations(request.netram!, q.projectId, q.from, q.to);
    },
  );

  app.get(
    "/attendance/identity-mappings",
    {
      schema: {
        tags: ["attendance"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("AttendanceIdentityQuery", attendanceOverviewQuerySchema),
      },
    },
    async (request) => {
      const q = request.query as unknown as { projectId: string; page?: number; pageSize?: number };
      return svc.listIdentityMappings(request.netram!, q.projectId, q.page, q.pageSize);
    },
  );

  /* ---------- Ingestion (§6, §9, §19) ---------- */

  app.post(
    "/attendance/devices/:id/sync",
    {
      schema: {
        tags: ["attendance"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        querystring: toJsonSchema(
          "AttendanceSyncQuery",
          z
            .object({
              cursor: z.string().nullable().optional(),
              operationalDate: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}$/)
                .optional(),
            })
            .passthrough(),
        ),
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const q = request.query as unknown as { cursor?: string | null; operationalDate?: string };
      return svc.syncDevice(request.netram!, id, {
        cursor: q.cursor ?? null,
        operationalDate: q.operationalDate,
      });
    },
  );

  app.post(
    "/attendance/devices/:id/events",
    {
      schema: {
        tags: ["attendance"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("AttendanceSyncEventsBody", syncDeviceEventsSchema),
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        events: {
          deviceEventId?: string | null;
          externalUserId: string;
          rawType?: string;
          occurredAt: string;
          payload?: Record<string, unknown> | null;
        }[];
      };
      return svc.ingestProviderEvents(
        request.netram!,
        id,
        body.events.map((e) => ({
          deviceEventId: e.deviceEventId ?? null,
          externalUserId: e.externalUserId,
          rawType: e.rawType ?? "fingerprint_verified",
          occurredAt: new Date(e.occurredAt),
          payload: e.payload ?? null,
        })),
      );
    },
  );

  /* ---------- Source observations (§4, §22) ---------- */

  app.post(
    "/attendance/observations",
    {
      schema: {
        tags: ["attendance"],
        security: [{ bearerAuth: [] }],
        body: toJsonSchema("AttendanceSourceObservationBody", recordSourceObservationSchema),
        response: { 201: toJsonSchema("AttendanceSourceObservation", sourceObservationSchema) },
      },
    },
    async (request, reply) => {
      const body = request.body as Parameters<typeof svc.recordSourceObservation>[1];
      const result = await svc.recordSourceObservation(request.netram!, body);
      return reply.code(201).send(result);
    },
  );

  /* ---------- Anomalies (§30-§33) ---------- */

  app.get(
    "/attendance/anomalies",
    {
      schema: {
        tags: ["attendance"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("AttendanceAnomalyQuery", attendanceAnomalyQuerySchema),
        response: { 200: toJsonSchema("AttendanceAnomalyPage", anomalyPageSchema) },
      },
    },
    async (request) => {
      const q = request.query as unknown as {
        projectId?: string;
        type?: string;
        severity?: string;
        state?: string;
        from?: string;
        to?: string;
        page?: number;
        pageSize?: number;
      };
      return svc.listAnomalies(request.netram!, {
        projectId: q.projectId,
        type: q.type,
        severity: q.severity,
        state: q.state,
        from: q.from,
        to: q.to,
        page: q.page,
        pageSize: q.pageSize,
      });
    },
  );

  app.get(
    "/attendance/anomalies/:id",
    {
      schema: {
        tags: ["attendance"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: { 200: toJsonSchema("AttendanceAnomaly", anomalyPageSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const anomaly = await svc.getAnomaly(request.netram!, id);
      return {
        items: [anomaly],
        total: 1,
        page: 1,
        pageSize: 20,
      };
    },
  );

  app.post(
    "/attendance/anomalies/:id/review",
    {
      schema: {
        tags: ["attendance"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("AttendanceAnomalyReviewBody", attendanceAnomalyReviewSchema),
        response: { 200: toJsonSchema("AttendanceAnomaly", anomalyPageSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as AttendanceAnomalyReviewInput;
      const anomaly = await svc.reviewAnomaly(request.netram!, id, body);
      return {
        items: [anomaly],
        total: 1,
        page: 1,
        pageSize: 20,
      };
    },
  );

  app.get(
    "/attendance/anomalies/:id/review-actions",
    {
      schema: {
        tags: ["attendance"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return svc.listReviewActions(request.netram!, id);
    },
  );

  /* ---------- Individual drill-down (§37) ---------- */

  app.get(
    "/attendance/individual",
    {
      schema: {
        tags: ["attendance"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("AttendanceDrillDownQuery", attendanceDrillDownQuerySchema),
        response: {
          200: {
            type: "array",
            items: toJsonSchema("AttendanceDrillDownRow", drillDownRowSchema),
          },
        },
      },
    },
    async (request) => {
      const q = request.query as unknown as {
        projectId: string;
        personExternalId?: string;
        windowId?: string;
        operationalDate?: string;
        from?: string;
        to?: string;
      };
      if (!q.personExternalId) {
        return svc.listCalculations(request.netram!, {
          projectId: q.projectId,
          windowId: q.windowId,
          from: q.from,
          to: q.to,
        });
      }
      return svc.drillDown(request.netram!, {
        projectId: q.projectId,
        personExternalId: q.personExternalId,
        windowId: q.windowId,
        operationalDate: q.operationalDate,
        from: q.from,
        to: q.to,
      });
    },
  );

  /* ---------- Configuration (§43) ---------- */

  app.get(
    "/attendance/config",
    {
      schema: {
        tags: ["attendance"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema(
          "AttendanceConfigQuery",
          z.object({ projectId: z.string().uuid().optional() }),
        ),
        response: { 200: toJsonSchema("AttendanceConfig", configSchema) },
      },
    },
    async (request) => {
      const { projectId } = request.query as { projectId?: string };
      return svc.getConfig(request.netram!, projectId);
    },
  );

  app.put(
    "/attendance/config",
    {
      schema: {
        tags: ["attendance"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema(
          "AttendanceConfigQuery",
          z.object({ projectId: z.string().uuid().optional() }),
        ),
        body: toJsonSchema("AttendanceConfigUpdateBody", attendanceConfigUpdateSchema),
        response: { 200: toJsonSchema("AttendanceConfig", configSchema) },
      },
    },
    async (request) => {
      const { projectId } = request.query as { projectId?: string };
      const body = request.body as Parameters<typeof svc.updateConfig>[2];
      return svc.updateConfig(request.netram!, projectId ?? null, body);
    },
  );

  /* ---------- Corrections (§34) ---------- */

  app.post(
    "/attendance/corrections",
    {
      schema: {
        tags: ["attendance"],
        security: [{ bearerAuth: [] }],
        body: toJsonSchema("AttendanceCorrectionBody", attendanceCorrectionSchema),
        response: { 201: toJsonSchema("AttendanceCorrection", correctionSchema) },
      },
    },
    async (request, reply) => {
      const body = request.body as AttendanceCorrectionInput;
      const result = await svc.createCorrection(request.netram!, body);
      return reply.code(201).send(result);
    },
  );

  app.get(
    "/attendance/corrections",
    {
      schema: {
        tags: ["attendance"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema(
          "AttendanceCorrectionsQuery",
          z.object({ projectId: z.string().uuid() }),
        ),
      },
    },
    async (request) => {
      const { projectId } = request.query as { projectId: string };
      return svc.listCorrections(request.netram!, projectId);
    },
  );

  app.post(
    "/attendance/corrections/:id/decide",
    {
      schema: {
        tags: ["attendance"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("AttendanceCorrectionApprovalBody", attendanceCorrectionApprovalSchema),
        response: { 200: toJsonSchema("AttendanceCorrection", correctionSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as { decision: "approve" | "reject" };
      return svc.decideCorrection(request.netram!, id, body.decision);
    },
  );

  /* ---------- Exports (§38-§41) ---------- */

  app.post(
    "/attendance/exports",
    {
      schema: {
        tags: ["attendance"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("AttendanceExportQuery", attendanceExportQuerySchema),
      },
    },
    async (request, reply) => {
      const q = request.query as unknown as AttendanceExportQuery;
      const result = await svc.requestExport(request.netram!, {
        projectId: q.projectId,
        districtId: q.districtId,
        from: q.from,
        to: q.to,
      });
      if (result.csv !== undefined) {
        void reply.header("Content-Type", "text/csv");
        void reply.header("Content-Disposition", `attachment; filename="attendance.csv"`);
        return reply.send(result.csv);
      }
      return reply.code(202).send(result.export);
    },
  );

  app.get(
    "/attendance/exports",
    {
      schema: {
        tags: ["attendance"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema(
          "AttendanceExportsQuery",
          z.object({ projectId: z.string().uuid() }),
        ),
      },
    },
    async (request) => {
      const { projectId } = request.query as { projectId: string };
      return svc.listExports(request.netram!, projectId);
    },
  );

  app.get(
    "/attendance/exports/:id",
    {
      schema: {
        tags: ["attendance"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: { 200: toJsonSchema("AttendanceExport", exportSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return svc.getExport(request.netram!, id);
    },
  );

  app.get(
    "/attendance/exports/:id/download",
    {
      schema: {
        tags: ["attendance"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await svc.downloadExport(request.netram!, id);
      void reply.header("Content-Type", "text/csv");
      void reply.header("Content-Disposition", `attachment; filename="${result.filename}"`);
      return reply.send(result.csv);
    },
  );
}