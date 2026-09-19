import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import {
  assignRoleSchema,
  idParamsSchema,
  jurisdictionViewSchema,
  roleAssignmentViewSchema,
  roleViewSchema,
  updateRolePermissionsSchema,
  updateUserSchema,
  userAdminViewSchema,
  userListQuerySchema,
  userListResponseSchema,
} from "@netram/validation";
import type { UserListQuery } from "@netram/types";

export async function registerUserAdminRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  const userAdminService = container.userAdminService;
  const paramsSchema = toJsonSchema("UserAdminIdParams", idParamsSchema);
  const codeParamsSchema = toJsonSchema(
    "RoleCodeParams",
    z.object({ id: z.string().min(1).max(50) }).strict(),
  );

  app.get(
    "/users",
    {
      schema: {
        tags: ["user-admin"],
        security: [{ bearerAuth: [] }],
        querystring: toJsonSchema("UserListQuery", userListQuerySchema),
        response: {
          200: toJsonSchema("UserListResponse", userListResponseSchema),
        },
      },
    },
    async (request) => {
      const q = request.query as unknown as UserListQuery;
      return userAdminService.listUsers(request.netram!, q);
    },
  );

  app.get(
    "/users/:id",
    {
      schema: {
        tags: ["user-admin"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: { 200: toJsonSchema("UserAdminView", userAdminViewSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return userAdminService.getUser(request.netram!, id);
    },
  );

  app.patch(
    "/users/:id",
    {
      schema: {
        tags: ["user-admin"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("UpdateUserBody", updateUserSchema),
        response: { 200: toJsonSchema("UserAdminView", userAdminViewSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        displayName?: string;
        status?: "active" | "suspended";
      };
      return userAdminService.updateUser(request.netram!, id, body);
    },
  );

  app.post(
    "/users/:id/role-assignments",
    {
      schema: {
        tags: ["user-admin"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        body: toJsonSchema("AssignRoleBody", assignRoleSchema),
        response: {
          201: toJsonSchema("RoleAssignmentView", roleAssignmentViewSchema),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await userAdminService.assignRole(
        request.netram!,
        id,
        request.body as Parameters<typeof userAdminService.assignRole>[2],
      );
      void reply.code(201);
      return result;
    },
  );

  app.delete(
    "/role-assignments/:id",
    {
      schema: {
        tags: ["user-admin"],
        security: [{ bearerAuth: [] }],
        params: paramsSchema,
        response: { 204: { type: "null" } },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await userAdminService.removeRoleAssignment(request.netram!, id);
      void reply.code(204);
      return null;
    },
  );

  app.get(
    "/roles",
    {
      schema: {
        tags: ["user-admin"],
        security: [{ bearerAuth: [] }],
        response: {
          200: toJsonSchema("RoleViewList", z.array(roleViewSchema)),
        },
      },
    },
    async (request) => userAdminService.listRoles(request.netram!),
  );

  app.put(
    "/roles/:id/permissions",
    {
      schema: {
        tags: ["user-admin"],
        security: [{ bearerAuth: [] }],
        params: codeParamsSchema,
        body: toJsonSchema("UpdateRolePermissionsBody", updateRolePermissionsSchema),
        response: { 200: toJsonSchema("RoleView", roleViewSchema) },
      },
    },
    async (request) => {
      const { id: code } = request.params as { id: string };
      const body = request.body as { permissions: string[] };
      return userAdminService.updateRolePermissions(request.netram!, code, body);
    },
  );

  app.get(
    "/jurisdictions",
    {
      schema: {
        tags: ["user-admin"],
        security: [{ bearerAuth: [] }],
        response: {
          200: toJsonSchema("JurisdictionViewList", z.array(jurisdictionViewSchema)),
        },
      },
    },
    async (request) => userAdminService.listJurisdictions(request.netram!),
  );
}
