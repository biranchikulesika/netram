import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type NetramApiClient } from "@netram/api-client";
import type { Inspection } from "@netram/types";
import { InMemorySqliteDatabase, setTestDatabase } from "./db";
import { OfflineInspectionQueue, type CachedInspectionRecord } from "./queue";
import {
  filterAssignedInspections,
  refreshInspectionsFromServer,
} from "./inspection-feed";

const INSPECTOR_ID = "usr-insp-001";
const OTHER_INSPECTOR_ID = "usr-insp-002";

function inspection(id: string, assignees: string[]): Inspection {
  return {
    id,
    projectId: `proj-${id}`,
    projectCode: `PRJ-${id}`,
    projectName: `Facility ${id}`,
    districtName: "Khordha",
    districtId: "dist-khordha",
    type: "routine",
    trigger: "officer",
    status: "assigned",
    templateId: null,
    disclosurePolicyId: null,
    disclosureRuleType: null,
    scheduledStart: "2026-09-28T09:00:00Z",
    scheduledEnd: "2026-09-28T17:00:00Z",
    startedAt: null,
    submittedAt: null,
    assignedUserIds: assignees,
    createdAt: "2026-09-20T00:00:00Z",
    updatedAt: "2026-09-20T00:00:00Z",
  };
}

function cachedRecord(id: string, assignedUserIds: string): CachedInspectionRecord {
  return {
    id,
    project_id: `proj-${id}`,
    project_name: `Facility ${id}`,
    project_code: `PRJ-${id}`,
    type: "routine",
    status: "assigned",
    district_id: "dist-khordha",
    district_name: "Khordha",
    scheduled_start: "2026-09-28T09:00:00Z",
    scheduled_end: "2026-09-28T17:00:00Z",
    started_at: null,
    submitted_at: null,
    assigned_user_ids: assignedUserIds,
    cached_at: "2026-09-20T00:00:00Z",
  };
}

describe("Assigned inspection feed", () => {
  describe("filterAssignedInspections", () => {
    const records = [
      cachedRecord("mine", JSON.stringify([INSPECTOR_ID])),
      cachedRecord("theirs", JSON.stringify([OTHER_INSPECTOR_ID])),
      cachedRecord("shared", JSON.stringify([OTHER_INSPECTOR_ID, INSPECTOR_ID])),
    ];

    it("keeps only inspections assigned to the signed-in inspector", () => {
      const filtered = filterAssignedInspections(records, INSPECTOR_ID);
      expect(filtered.map((r) => r.id)).toEqual(["mine", "shared"]);
    });

    it("drops rows whose assignee payload cannot be parsed", () => {
      const malformed = [cachedRecord("broken", "not-json")];
      expect(filterAssignedInspections(malformed, INSPECTOR_ID)).toEqual([]);
    });

    it("returns every cached row when there is no resolved user id yet", () => {
      expect(filterAssignedInspections(records, undefined)).toHaveLength(records.length);
    });
  });

  describe("refreshInspectionsFromServer", () => {
    let db: InMemorySqliteDatabase;
    let queue: OfflineInspectionQueue;

    beforeEach(async () => {
      db = new InMemorySqliteDatabase();
      setTestDatabase(db);
      queue = new OfflineInspectionQueue(async () => db);
    });

    it("caches the assignments the server returns", async () => {
      const client = {
        listInspections: vi.fn(async () => ({
          items: [inspection("insp-1", [INSPECTOR_ID]), inspection("insp-2", [INSPECTOR_ID])],
          total: 2,
          page: 1,
          pageSize: 50,
        })),
      } as unknown as NetramApiClient;

      await expect(refreshInspectionsFromServer(client, queue)).resolves.toBe("refreshed");
      expect(client.listInspections).toHaveBeenCalledWith({ pageSize: 50 });

      const cached = await queue.getCachedInspections();
      expect(cached.map((c) => c.id).sort()).toEqual(["insp-1", "insp-2"]);
      expect(filterAssignedInspections(cached, INSPECTOR_ID)).toHaveLength(2);
    });

    it("reports failure and keeps the cached assignments when the API is unreachable", async () => {
      await queue.cacheInspections([inspection("insp-cached", [INSPECTOR_ID])]);

      const client = {
        listInspections: vi.fn(async () => {
          throw new Error("Network request failed");
        }),
      } as unknown as NetramApiClient;

      await expect(refreshInspectionsFromServer(client, queue)).resolves.toBe("unavailable");
      expect(await queue.getCachedInspections()).toHaveLength(1);
    });

    it("reports an expired session distinctly from being offline", async () => {
      // A 401 must never be reported as a plain failure: collapsed into the same
      // result it renders as an empty assignment list for a signed-in inspector.
      await queue.cacheInspections([inspection("insp-cached", [INSPECTOR_ID])]);

      const client = {
        listInspections: vi.fn(async () => {
          throw new ApiError(401, {
            error: { code: "UNAUTHORIZED", message: "Invalid or expired token." },
          });
        }),
      } as unknown as NetramApiClient;

      await expect(refreshInspectionsFromServer(client, queue)).resolves.toBe("unauthorized");
      expect(await queue.getCachedInspections()).toHaveLength(1);
    });

    it("does not wipe cached assignments when the server returns an empty page", async () => {
      await queue.cacheInspections([inspection("insp-cached", [INSPECTOR_ID])]);

      const client = {
        listInspections: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 50 })),
      } as unknown as NetramApiClient;

      await expect(refreshInspectionsFromServer(client, queue)).resolves.toBe("refreshed");
      expect(await queue.getCachedInspections()).toHaveLength(1);
    });
  });
});