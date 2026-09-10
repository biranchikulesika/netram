import type { FastifyRequest } from "fastify";
import type { AuthenticatedUser } from "@netram/types";
import type { AssignmentContext } from "@netram/data";

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

export function getRequestUser(req: FastifyRequest): RequestUserContext {
  const ctx = req.netram;
  if (!ctx) {
    throw new Error("Request did not pass through the authentication hook.");
  }
  return ctx;
}
