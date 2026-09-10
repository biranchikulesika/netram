import type { FastifyInstance } from "fastify";
import type { Container } from "../../../infrastructure/container.js";
import { toJsonSchema } from "../../../infrastructure/schema-helper.js";
import { devLoginSchema } from "@netram/validation";
import { AppError } from "../../../infrastructure/errors.js";

export async function registerAuthRoutes(
  app: FastifyInstance,
  container: Container,
): Promise<void> {
  // Development-only login. Registered solely to unblock local work with seed
  // users. It is never available outside the "dev" auth provider mode.
  app.post(
    "/auth/dev-login",
    {
      config: { public: true },
      schema: {
        tags: ["auth"],
        body: toJsonSchema("DevLoginBody", devLoginSchema),
        response: {
          200: {
            type: "object",
            properties: {
              token: { type: "string" },
              user: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  displayName: { type: ["string", "null"] },
                  type: { type: "string" },
                },
                required: ["id", "email", "type"],
              },
            },
          },
        },
      },
    },
    async (request) => {
      if (!container.devAuthProvider) {
        throw AppError.notFound("Dev login is not enabled.");
      }
      const { email } = request.body as { email: string };
      return container.authService.devLogin(email, (userId, userEmail, displayName) =>
        (container.devAuthProvider as NonNullable<Container["devAuthProvider"]>).signDevToken(
          userId,
          userEmail,
          displayName,
        ),
      );
    },
  );

  app.get(
    "/auth/me",
    {
      schema: {
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              user: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  displayName: { type: ["string", "null"] },
                  type: { type: "string" },
                },
              },
              permissions: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
    async (request) => ({
      user: request.netram!.user,
      permissions: [...request.netram!.permissions],
    }),
  );
}
