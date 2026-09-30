import type { FastifyReply, FastifyRequest } from "fastify";
import { PUBLIC_API_PATH_PREFIXES } from "@netram/types";

/**
 * Unauthenticated API paths. The list itself is a shared contract (it is also
 * needed by the web BFF, which must proxy these paths without a session token)
 * and therefore lives in @netram/types. Re-exported here for API-internal use.
 */
export const PUBLIC_PATH_PREFIXES = PUBLIC_API_PATH_PREFIXES;

export function isPublicRoute(req: FastifyRequest): boolean {
  const cfg = (req.routeOptions?.config as unknown as Record<string, unknown> | undefined) ?? {};
  if (cfg.public === true) return true;
  return PUBLIC_PATH_PREFIXES.some((p) => req.url.startsWith(p) || req.url === p.slice(0, -1));
}

export type Authenticator = (req: FastifyRequest, reply: FastifyReply) => Promise<void> | void;
