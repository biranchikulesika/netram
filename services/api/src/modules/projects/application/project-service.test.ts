import { describe, expect, it, vi } from "vitest";
import { ProjectService } from "./project-service.js";
import type { ProjectRepositoryPort } from "./ports/project-repository.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";

describe("ProjectService.listPublicRegistry", () => {
  it("returns minimal id/code/name references without authorization", async () => {
    const authz = {} as AuthorizationService;
    const repo = {
      list: vi.fn().mockResolvedValue({
        items: [
          { id: "proj-1", code: "OD-KHD-001", name: "Vani Vihar Degree College" },
          { id: "proj-2", code: "OD-KHD-002", name: "Nandankanan Water Supply" },
        ],
        total: 2,
        page: 1,
        pageSize: 1000,
      }),
    } as unknown as ProjectRepositoryPort;

    const service = new ProjectService(authz, repo);
    const registry = await service.listPublicRegistry();

    expect(registry).toEqual([
      { id: "proj-1", code: "OD-KHD-001", name: "Vani Vihar Degree College" },
      { id: "proj-2", code: "OD-KHD-002", name: "Nandankanan Water Supply" },
    ]);
    expect(repo.list).toHaveBeenCalledWith({ page: 1, pageSize: 1000 });
  });
});