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
      // A real authentication/authorization failure is a verdict about the
      // caller: audit it, and let the client act on it (sign in again, fix
      // permissions).
      //
      // Anything that is NOT an AppError means we could not determine who the
      // caller is — a dropped connection, a missing relation, a failing
      // repository. That is emphatically not "unauthorised": answering 401 here
      // makes an infrastructure outage indistinguishable from a bad token, and
      // a client that trusts the status code will sign the user out or show a
      // login screen for a session that is perfectly valid. It must be a 5xx,
      // it must not be recorded as an authorisation failure, and the underlying
      // error must be logged rather than discarded.
      if (!(err instanceof AppError)) {
        log.error({ err, path: request.url }, "Authentication failed for an infrastructure reason");
        throw AppError.internal();
      }

      void container.auditRepo
        .append({
          action: "auth.authorization_failed",
          actorUserId: null,
          requestId: request.id,
          ipAddress: request.ip ?? "unknown",
          metadata: { code: err.code, path: request.url },
        })
        .catch((e: unknown) => {
          log.error({ err: e }, "Failed to record authorization audit event");
        });
      throw err;
    }
  };
}
