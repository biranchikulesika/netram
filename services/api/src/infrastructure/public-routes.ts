import type { FastifyReply, FastifyRequest } from "fastify";

export const PUBLIC_PATH_PREFIXES = [
  "/docs",
  "/openapi.json",
  "/health",
  "/ready",
  "/api/v1/auth/dev-login",
  "/api/v1/info",
  "/api/v1/complaints/track",
];

export function isPublicRoute(req: FastifyRequest): boolean {
  const cfg = (req.routeOptions?.config as unknown as Record<string, unknown> | undefined) ?? {};
  if (cfg.public === true) return true;
  return PUBLIC_PATH_PREFIXES.some((p) => req.url.startsWith(p) || req.url === p.slice(0, -1));
}

export type Authenticator = (req: FastifyRequest, reply: FastifyReply) => Promise<void> | void;
