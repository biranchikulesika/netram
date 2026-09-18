import { describe, expect, it, vi } from "vitest";
import { AuditService } from "./audit-service.js";
import { AppError } from "../../../infrastructure/errors.js";
import type { AuditRepositoryPort } from "./ports/audit-repository.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";

function mockAuthz(permissions: Set<string> = new Set(["audit:read"])): AuthorizationService {
  return {
    requirePermission(_ctx: RequestUserContext, perm: string) {
      if (!permissions.has(perm)) throw AppError.forbidden(`Missing permission: ${perm}`);
    },
    hasPermission: vi.fn(),
    canAccessDistrict: vi.fn(),
    accessibleDistrictIds: vi.fn(),
    effectiveAuthorityIds: vi.fn(),
  } as unknown as AuthorizationService;
}

function mockRepo(): AuditRepositoryPort {
  return {
    append: vi.fn(),
    list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  };
}

const ctx: RequestUserContext = {
  userId: "u1",
  user: { id: "u1", email: "test@test.com", displayName: "Test", type: "netram" },
  permissions: new Set(["audit:read"]),
  assignments: [],
  requestId: "req-1",
  ipAddress: "127.0.0.1",
};

describe("AuditService", () => {
  it("throws FORBIDDEN when audit:read is missing", async () => {
    const svc = new AuditService(mockAuthz(new Set()), mockRepo());
    await expect(svc.listAuditEvents(ctx, {})).rejects.toThrow("Missing permission: audit:read");
  });

  it("lists audit events with default pagination", async () => {
    const repo = mockRepo();
    const svc = new AuditService(mockAuthz(), repo);
    const result = await svc.listAuditEvents(ctx, {});
    expect(repo.list).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  it("passes through custom pagination", async () => {
    const repo = mockRepo();
    const svc = new AuditService(mockAuthz(), repo);
    await svc.listAuditEvents(ctx, { page: 3, pageSize: 50 });
    expect(repo.list).toHaveBeenCalledWith({ page: 3, pageSize: 50 });
  });
});
