import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { ZodError } from "zod";
import type { FastifyError } from "fastify";
import type { ApiErrorBody } from "@netram/types";
import type { Container } from "./infrastructure/container.js";
import { AppError } from "./infrastructure/errors.js";
import { createAuthHook } from "./infrastructure/auth-hook.js";
import { InvalidTransitionError } from "./modules/projects/domain/project.js";
import { InvalidInspectionTransitionError } from "./modules/inspections/domain/inspection.js";
import { InvalidFindingTransitionError } from "./modules/findings/domain/finding.js";
import { InvalidCorrectiveActionTransitionError } from "./modules/corrective-actions/domain/corrective-action.js";
import { InvalidObservationStageError } from "./modules/observations/domain/observation.js";
import { InvalidEvidenceTransitionError } from "./modules/evidence/domain/evidence.js";
import { InvalidComplaintTransitionError } from "./modules/complaints/domain/complaint.js";
import { InvalidAiAnomalyTransitionError } from "./modules/ai-anomalies/domain/ai-anomaly.js";
import { InvalidReportTransitionError } from "./modules/reports/domain/report.js";
import { InvalidAttendanceAnomalyTransitionError } from "./modules/attendance/domain/attendance-anomaly.js";
import { registerHealthRoutes } from "./modules/health/http/routes.js";
import { registerAuthRoutes } from "./modules/auth/http/routes.js";
import { registerProjectRoutes } from "./modules/projects/http/routes.js";
import { registerInspectionRoutes } from "./modules/inspections/http/routes.js";
import { registerFindingRoutes } from "./modules/findings/http/routes.js";
import { registerCorrectiveActionRoutes } from "./modules/corrective-actions/http/routes.js";
import { registerObservationRoutes } from "./modules/observations/http/routes.js";
import { registerEvidenceRoutes } from "./modules/evidence/http/routes.js";
import { registerComplaintRoutes } from "./modules/complaints/http/routes.js";
import { registerAuditRoutes } from "./modules/audit/http/routes.js";
import { registerAiAnomalyRoutes } from "./modules/ai-anomalies/http/routes.js";
import { registerAssignmentRoutes } from "./modules/assignments/http/routes.js";
import { registerNotificationRoutes } from "./modules/notifications/http/routes.js";
import { registerReportRoutes } from "./modules/reports/http/routes.js";
import { registerUserAdminRoutes } from "./modules/user-admin/http/routes.js";
import { registerRealtimeAuthorizeRoutes } from "./modules/realtime/http/routes.js";
import { registerCctvRoutes } from "./modules/cctv/http/routes.js";
import { registerVcRoutes } from "./modules/vc/http/routes.js";
import { registerAttendanceRoutes } from "./modules/attendance/http/routes.js";
import { registerAnalyticsRoutes } from "./modules/analytics/http/routes.js";
import { InvalidVcSessionTransitionError } from "./modules/vc/domain/vc-session.js";

export async function buildApp(container: Container) {
  const app = Fastify({
    logger: {
      level: container.config.LOG_LEVEL,
      redact: ["req.headers.authorization", "req.headers.cookie"],
    },
    genReqId: (req) => (req.headers["x-request-id"] as string | undefined) ?? randomUUID(),
  });

  app.addHook("onSend", (_req, reply, payload, done) => {
    void reply.header("x-request-id", (reply.request.id as string) ?? "generated");
    done(null, payload);
  });

  await app.register(cors, { origin: container.config.NETRAM_CORS_ORIGIN });
  await app.register(multipart, {
    limits: { fileSize: 100 * 1024 * 1024, files: 1, fields: 4 },
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Netram API",
        description: "Smart Real-Time Monitoring & Inspection platform for DoSJE",
        version: "0.1.0",
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
      tags: [
        { name: "system", description: "Health and readiness" },
        { name: "auth", description: "Authentication" },
        { name: "projects", description: "Project lifecycle" },
        {
          name: "inspections",
          description: "Inspection lifecycle and disclosure",
        },
        {
          name: "findings",
          description: "Authority review of inspection findings",
        },
        {
          name: "corrective-actions",
          description: "Corrective action orders and remediation",
        },
        { name: "observations", description: "Inspector field observations" },
        { name: "evidence", description: "Evidence metadata and integrity" },
        {
          name: "complaints",
          description: "Oversight complaints and resolution",
        },
        { name: "audit", description: "Append-only audit trail" },
        { name: "ai-anomalies", description: "Advisory AI anomaly alerts" },
        {
          name: "assignments",
          description: "Inspector assignments and inspection teams",
        },
        { name: "notifications", description: "In-app notifications" },
        { name: "reports", description: "Derived inspection reports" },
        { name: "realtime", description: "Realtime authorization" },
        { name: "cctv", description: "CCTV stream abstraction and cameras" },
        { name: "vc", description: "Video conferencing and remote review sessions" },
        { name: "attendance", description: "Attendance monitoring and anomaly oversight" },
      ],
    },
  });

  await app.register(swaggerUi, { routePrefix: "/docs" });

  app.addHook("onRequest", createAuthHook(container, app.log));

  app.setErrorHandler((err: FastifyError, request, reply) => {
    const requestId = request.id;
    const log = request.log;

    if (err instanceof AppError) {
      const body: ApiErrorBody = {
        error: {
          code: err.code,
          message: err.message,
          requestId,
          details: err.details,
        },
      };
      void reply.code(err.statusCode).send(body);
      return;
    }

    if (err instanceof InvalidTransitionError) {
      const body: ApiErrorBody = {
        error: {
          code: "INVALID_STATE_TRANSITION",
          message: err.message,
          requestId,
        },
      };
      void reply.code(409).send(body);
      return;
    }

    if (err instanceof InvalidInspectionTransitionError) {
      const body: ApiErrorBody = {
        error: {
          code: "INVALID_STATE_TRANSITION",
          message: err.message,
          requestId,
        },
      };
      void reply.code(409).send(body);
      return;
    }

    if (
      err instanceof InvalidFindingTransitionError ||
      err instanceof InvalidCorrectiveActionTransitionError ||
      err instanceof InvalidObservationStageError ||
      err instanceof InvalidEvidenceTransitionError ||
      err instanceof InvalidComplaintTransitionError ||
      err instanceof InvalidAiAnomalyTransitionError ||
      err instanceof InvalidReportTransitionError ||
      err instanceof InvalidVcSessionTransitionError ||
      err instanceof InvalidAttendanceAnomalyTransitionError
    ) {
      const body: ApiErrorBody = {
        error: {
          code: "INVALID_STATE_TRANSITION",
          message: err.message,
          requestId,
        },
      };
      void reply.code(409).send(body);
      return;
    }

    if (err instanceof ZodError) {
      void reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed.",
          requestId,
          details: { issues: err.issues },
        },
      } satisfies ApiErrorBody);
      return;
    }

    if (err.validation || err.code === "FST_ERR_VALIDATION") {
      log.info({ validationError: err }, "Request schema validation failed");
      void reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed.",
          requestId,
          details: { issues: err.validation ?? err.message },
        },
      } satisfies ApiErrorBody);
      return;
    }

    log.error({ err }, "Unhandled error");
    void reply.code(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred.",
        requestId,
      },
    } satisfies ApiErrorBody);
  });

  app.setNotFoundHandler((request, reply) => {
    const requestId = request.id;
    const body: ApiErrorBody = {
      error: {
        code: "NOT_FOUND",
        message: `Route ${request.method}:${request.url} not found`,
        requestId,
      },
    };
    void reply.code(404).send(body);
  });


  // Health/liveness routes are intentionally OUTSIDE /api/v1 and unprefixed so
  // load balancers/k8s probes can reach them without auth. Do not move them
  // under /api/v1 or behind bearerAuth. (AGENTS.md §54, docs/contracts/README.md)
  await app.register(async (api) => {
    await registerHealthRoutes(api, container);
  });

  await app.register(
    async (api) => {
      await registerAuthRoutes(api, container);
      await registerProjectRoutes(api, container);
      await registerInspectionRoutes(api, container);
      await registerFindingRoutes(api, container);
      await registerCorrectiveActionRoutes(api, container);
      await registerObservationRoutes(api, container);
      await registerEvidenceRoutes(api, container);
      await registerComplaintRoutes(api, container);
      await registerAuditRoutes(api, container);
      await registerAiAnomalyRoutes(api, container);
      await registerAssignmentRoutes(api, container);
      await registerNotificationRoutes(api, container);
      await registerReportRoutes(api, container);
      await registerUserAdminRoutes(api, container);
      await registerRealtimeAuthorizeRoutes(api, container);
      await registerCctvRoutes(api, container);
      await registerVcRoutes(api, container);
      await registerAttendanceRoutes(api, container);
      await registerAnalyticsRoutes(api, container);
    },
    { prefix: "/api/v1" },
  );

  app.log.info("Netram API routes registered");
  return app;
}
