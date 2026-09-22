import type { FastifyInstance } from "fastify";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import {
  idParamsSchema,
  projectRiskRankingQuerySchema,
  projectRiskSnapshotQuerySchema,
} from "@netram/validation";
import type { ProjectRiskRankingQuery, ProjectRiskSnapshotQuery } from "@netram/types";

export async function registerProjectRiskRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  const riskService = container.projectRiskService;
  const paramsSchema = toJsonSchema("IdParams", idParamsSchema);

  // 1. Project Risk Rankings
  app.get(
    "/project-risk/rankings",
    {
      schema: {
        tags: ["project-risk"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("ProjectRiskRankingQuery", projectRiskRankingQuerySchema),
      },
    },
    async (request) => {
      const query = request.query as ProjectRiskRankingQuery;
      return riskService.listRankings(request.netram!, query);
    },
  );

  // 2. Latest Snapshot for a Project
  app.get(
    "/project-risk/projects/:id/latest",
    {
      schema: {
        tags: ["project-risk"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return riskService.getLatestSnapshot(request.netram!, id);
    },
  );

  // 3. Historical Snapshots for a Project
  app.get(
    "/project-risk/projects/:id/snapshots",
    {
      schema: {
        tags: ["project-risk"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        querystring: toJsonSchema(
          "ProjectRiskSnapshotListQuery",
          projectRiskSnapshotQuerySchema.omit({ projectId: true }),
        ),
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const query = request.query as Omit<ProjectRiskSnapshotQuery, "projectId">;
      return riskService.getRecentSnapshots(request.netram!, {
        projectId: id,
        ...query,
      });
    },
  );

  // 4. Evaluate single project risk score
  app.post(
    "/project-risk/evaluate/:id",
    {
      schema: {
        tags: ["project-risk"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return riskService.evaluateProject(request.netram!, id);
    },
  );

  // 5. Sweep all active projects
  app.post(
    "/project-risk/sweep",
    {
      schema: {
        tags: ["project-risk"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      return riskService.sweepAllActiveProjects(request.netram!);
    },
  );
}
