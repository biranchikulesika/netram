import type { FastifyRequest } from "fastify";
import type { AuthenticatedUser } from "@netram/types";
import type { AssignmentContext } from "@netram/data";
import { AppError } from "./errors.js";

export interface RequestUserContext {
  user: AuthenticatedUser;
  userId: string;
  assignments: AssignmentContext[];
  permissions: Set<string>;
  requestId: string;
  ipAddress: string;
}

declare module "fastify" {
  interface FastifyRequest {
    netram?: RequestUserContext;
  }
}

/**
 * Retrieves the authenticated user context attached by the auth hook.
 * Throws a standard AppError (not a raw Error) if the hook was bypassed,
 * ensuring the standard error envelope is always returned (§18).
 */
export function getRequestUser(req: FastifyRequest): RequestUserContext {
  const ctx = req.netram;
  if (!ctx) {
    throw AppError.internal(
      "Request did not pass through the authentication hook. This is a server configuration error.",
    );
  }
  return ctx;
}
