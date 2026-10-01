import { describe, expect, it, vi } from "vitest";
import type { FastifyRequest, FastifyBaseLogger } from "fastify";
import { createAuthHook } from "./auth-hook.js";
import { AppError } from "./errors.js";
import type { Container } from "./container.js";

/**
 * The authentication boundary must be able to tell three things apart:
 *
 *  - there is no token                      -> 401, auditable
 *  - the token is genuinely not acceptable  -> 401, auditable
 *  - we could not find out who the caller is -> 5xx, NOT auditable as an
 *    authorisation failure
 *
 * Collapsing the third into the second is what made a database rebuild look
 * like a signed-out user: the web app is entitled to show a login screen on a
 * 401 and a reconnecting state on a 5xx, so getting this wrong logs real users
 * out and destroys their session for no reason.
 */

function makeRequest(headers: Record<string, string | undefined> = {}): FastifyRequest {
  return {
    headers: { authorization: "Bearer valid.token", ...headers },
    id: "req-1",
    url: "/api/v1/auth/me",
    ip: "127.0.0.1",
  } as unknown as FastifyRequest;
}

function makeContainer(authenticate: () => Promise<never>): Container {
  const append = vi.fn().mockResolvedValue(undefined);
  return {
    authService: { authenticate },
    auditRepo: { append },
  } as unknown as Container;
}

function makeLog(): FastifyBaseLogger {
  return {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  } as unknown as FastifyBaseLogger;
}

describe("createAuthHook", () => {
  it("rejects a request with no Authorization header as unauthorized", async () => {
    const container = makeContainer(async () => {
      throw new Error("must not be called");
    });
    const hook = createAuthHook(container, makeLog());

    await expect(
      hook(makeRequest({ authorization: undefined }), {} as never),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      statusCode: 401,
    });
  });

  it("propagates a genuine AppError as 401 and audits it", async () => {
    const container = makeContainer(async () => {
      throw AppError.unauthorized("Invalid or expired token.");
    });
    const hook = createAuthHook(container, makeLog());
    const request = makeRequest();

    await expect(hook(request, {} as never)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      statusCode: 401,
    });
    await vi.waitFor(() => {
      expect(container.auditRepo.append).toHaveBeenCalledWith(
        expect.objectContaining({ action: "auth.authorization_failed" }),
      );
    });
  });

  it("reports an infrastructure failure as 500, not as an authorization failure", async () => {
    // What a dropped relation or a dead connection actually looks like: a raw
    // driver error that AuthService does not wrap.
    const boom = new Error('relation "users" does not exist');
    const container = makeContainer(async () => {
      throw boom;
    });
    const log = makeLog();
    const hook = createAuthHook(container, log);
    const request = makeRequest();

    const error = await hook(request, {} as never).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("INTERNAL_ERROR");
    expect((error as AppError).statusCode).toBe(500);

    // It must not be laundered into an authorization failure: that would forge
    // an audit record blaming the caller for a server-side outage.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(container.auditRepo.append).not.toHaveBeenCalled();

    // And the underlying cause must be observable, not swallowed.
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: boom }),
      expect.stringContaining("infrastructure"),
    );
  });

  it("does not leak the internal error message to the caller", async () => {
    const container = makeContainer(async () => {
      throw new Error('password authentication failed for user "postgres"');
    });
    const hook = createAuthHook(container, makeLog());

    const error = (await hook(makeRequest(), {} as never).catch((e: unknown) => e)) as AppError;

    expect(error.message).not.toContain("postgres");
  });
});
