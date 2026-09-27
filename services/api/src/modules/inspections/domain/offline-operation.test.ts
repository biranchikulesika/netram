import { describe, expect, it } from "vitest";
import type { Inspection, OfflineOperation } from "@netram/types";
import { evaluateOfflineOperation } from "./offline-operation.js";

function makeInspection(status: Inspection["status"]): Inspection {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    projectId: "22222222-2222-4222-8222-222222222222",
    projectCode: "PRJ-001",
    projectName: "Hostel A",
    districtId: "33333333-3333-4333-8333-333333333333",
    templateId: null,
    type: "routine",
    trigger: "risk_engine",
    status,
    disclosurePolicyId: null,
    disclosureRuleType: null,
    scheduledStart: "2026-03-01T06:00:00Z",
    scheduledEnd: "2026-03-01T12:00:00Z",
    startedAt: null,
    submittedAt: null,
    assignedUserIds: ["44444444-4444-4444-8444-444444444444"],
    createdAt: "2026-03-01T00:00:00Z",
    updatedAt: "2026-03-01T00:00:00Z",
  };
}

describe("evaluateOfflineOperation", () => {
  describe("start_inspection", () => {
    it("accepts start for scheduled/assigned inspection", () => {
      const op: OfflineOperation = {
        operationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        inspectionId: "11111111-1111-4111-8111-111111111111",
        type: "start_inspection",
        timestamp: "2026-03-01T06:10:00Z",
        payload: {},
      };
      const res = evaluateOfflineOperation(makeInspection("assigned"), op);
      expect(res.outcome).toBe("accepted");
      expect(res.targetInspectionStatus).toBe("in_progress");
    });

    it("accepts start idempotently if already in_progress", () => {
      const op: OfflineOperation = {
        operationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        inspectionId: "11111111-1111-4111-8111-111111111111",
        type: "start_inspection",
        timestamp: "2026-03-01T06:10:00Z",
        payload: {},
      };
      const res = evaluateOfflineOperation(makeInspection("in_progress"), op);
      expect(res.outcome).toBe("accepted");
    });

    it("flags conflict if inspection is closed", () => {
      const op: OfflineOperation = {
        operationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        inspectionId: "11111111-1111-4111-8111-111111111111",
        type: "start_inspection",
        timestamp: "2026-03-01T06:10:00Z",
        payload: {},
      };
      const res = evaluateOfflineOperation(makeInspection("closed"), op);
      expect(res.outcome).toBe("conflict");
      expect(res.code).toBe("INVALID_STATUS_FOR_START");
    });
  });

  describe("record_observation", () => {
    it("accepts valid observation when in_progress", () => {
      const op: OfflineOperation = {
        operationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        inspectionId: "11111111-1111-4111-8111-111111111111",
        type: "record_observation",
        timestamp: "2026-03-01T06:30:00Z",
        payload: { text: "Wall dampness noted" },
      };
      const res = evaluateOfflineOperation(makeInspection("in_progress"), op);
      expect(res.outcome).toBe("accepted");
    });

    it("rejects empty observation text", () => {
      const op: OfflineOperation = {
        operationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        inspectionId: "11111111-1111-4111-8111-111111111111",
        type: "record_observation",
        timestamp: "2026-03-01T06:30:00Z",
        payload: { text: "   " },
      };
      const res = evaluateOfflineOperation(makeInspection("in_progress"), op);
      expect(res.outcome).toBe("rejected");
      expect(res.code).toBe("INVALID_OBSERVATION_PAYLOAD");
    });

    it("flags conflict if inspection is closed", () => {
      const op: OfflineOperation = {
        operationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        inspectionId: "11111111-1111-4111-8111-111111111111",
        type: "record_observation",
        timestamp: "2026-03-01T06:30:00Z",
        payload: { text: "Wall dampness noted" },
      };
      const res = evaluateOfflineOperation(makeInspection("closed"), op);
      expect(res.outcome).toBe("conflict");
    });
  });

  describe("submit_inspection", () => {
    it("accepts submit when in_progress", () => {
      const op: OfflineOperation = {
        operationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        inspectionId: "11111111-1111-4111-8111-111111111111",
        type: "submit_inspection",
        timestamp: "2026-03-01T11:00:00Z",
        payload: {},
      };
      const res = evaluateOfflineOperation(makeInspection("in_progress"), op);
      expect(res.outcome).toBe("accepted");
      expect(res.targetInspectionStatus).toBe("submitted");
    });

    it("flags conflict if unstarted", () => {
      const op: OfflineOperation = {
        operationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        inspectionId: "11111111-1111-4111-8111-111111111111",
        type: "submit_inspection",
        timestamp: "2026-03-01T11:00:00Z",
        payload: {},
      };
      const res = evaluateOfflineOperation(makeInspection("assigned"), op);
      expect(res.outcome).toBe("conflict");
      expect(res.code).toBe("CANNOT_SUBMIT_UNSTARTED");
    });
  });

  describe("check_in", () => {
    it("accepts valid GPS coordinates and records server jurisdiction validation message", () => {
      const op: OfflineOperation = {
        operationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        inspectionId: "11111111-1111-4111-8111-111111111111",
        type: "check_in",
        timestamp: "2026-03-01T06:05:00Z",
        payload: { latitude: 28.6139, longitude: 77.209, accuracy: 12.5 },
      };
      const res = evaluateOfflineOperation(makeInspection("assigned"), op);
      expect(res.outcome).toBe("accepted");
      expect(res.message).toContain("Server validates jurisdiction");
    });

    it("rejects invalid GPS coordinates", () => {
      const op: OfflineOperation = {
        operationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        inspectionId: "11111111-1111-4111-8111-111111111111",
        type: "check_in",
        timestamp: "2026-03-01T06:05:00Z",
        payload: { latitude: 999, longitude: 77.209 },
      };
      const res = evaluateOfflineOperation(makeInspection("assigned"), op);
      expect(res.outcome).toBe("rejected");
      expect(res.code).toBe("INVALID_CHECK_IN_COORDINATES");
    });
  });

  describe("record_attendance", () => {
    it("accepts valid worker headcount", () => {
      const op: OfflineOperation = {
        operationId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        inspectionId: "11111111-1111-4111-8111-111111111111",
        type: "record_attendance",
        timestamp: "2026-03-01T06:15:00Z",
        payload: { workerCount: 42, note: "Day shift crew present" },
      };
      const res = evaluateOfflineOperation(makeInspection("in_progress"), op);
      expect(res.outcome).toBe("accepted");
      expect(res.message).toContain("Attendance headcount record verified");
    });

    it("rejects unreasonable worker headcount", () => {
      const op: OfflineOperation = {
        operationId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        inspectionId: "11111111-1111-4111-8111-111111111111",
        type: "record_attendance",
        timestamp: "2026-03-01T06:15:00Z",
        payload: { workerCount: -5 },
      };
      const res = evaluateOfflineOperation(makeInspection("in_progress"), op);
      expect(res.outcome).toBe("rejected");
      expect(res.code).toBe("INVALID_WORKER_COUNT");
    });
  });
});
