import type { FastifyReply, FastifyRequest } from "fastify";
import type { FastifyBaseLogger } from "fastify";
import type { Container } from "./container.js";
import { isPublicRoute } from "./public-routes.js";
import { AppError } from "./errors.js";

/**
 * Authentication boundary. Every non-public request must carry a bearer token
 * that resolves to a Netram user with a loaded authorization context.
 * Failures are audited (authorization failures are audit-worthy events).
 */
export function createAuthHook(container: Container, log: FastifyBaseLogger) {
  return async function authHook(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (isPublicRoute(request)) return;

    const header = request.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw AppError.unauthorized();
    }

    const token = header.slice("Bearer ".length);
    try {
      const ctx = await container.authService.authenticate(token);
      request.netram = {
        user: ctx.user,
        userId: ctx.userId,
        assignments: ctx.assignments,
        permissions: ctx.permissions,
        requestId: request.id,
        ipAddress: request.ip ?? "unknown",
      };
    } catch (err) {
      const appError = err instanceof AppError ? err : AppError.unauthorized();
      void container.auditRepo
        .append({
          action: "auth.authorization_failed",
          actorUserId: null,
          requestId: request.id,
          ipAddress: request.ip ?? "unknown",
          metadata: { code: appError.code, path: request.url },
        })
        .catch((e: unknown) => {
          log.error({ err: e }, "Failed to record authorization audit event");
        });
      throw appError;
    }
  };
}
