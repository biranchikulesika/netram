import { describe, it, expect } from "vitest";
import {
  operationalDayFor,
  inWindow,
  normalizeEventType,
  dedupKeyFor,
  eventEstablishesPresence,
  overallCoverage,
  assessDataQuality,
  calculateAttendance,
} from "./attendance.js";
import type { AttendanceSource, AttendanceEvent, AttendanceEventType } from "@netram/types";

describe("attendance domain", () => {
  describe("operationalDayFor", () => {
    it("assigns events before day start to previous calendar day", () => {
      // day start 05:00; 04:30 on 2026-03-01 → previous day
      expect(operationalDayFor(new Date("2026-03-01T04:30:00Z"), "05:00")).toBe("2026-02-28");
    });

    it("assigns events at or after day start to the same day", () => {
      expect(operationalDayFor(new Date("2026-03-01T05:00:00Z"), "05:00")).toBe("2026-03-01");
      expect(operationalDayFor(new Date("2026-03-01T12:00:00Z"), "05:00")).toBe("2026-03-01");
    });
  });

  describe("inWindow", () => {
    it("returns true for events inside the window", () => {
      expect(inWindow(new Date("2026-03-01T07:00:00Z"), "06:00", "09:00")).toBe(true);
    });

    it("returns false for events outside the window", () => {
      expect(inWindow(new Date("2026-03-01T05:00:00Z"), "06:00", "09:00")).toBe(false);
      expect(inWindow(new Date("2026-03-01T10:00:00Z"), "06:00", "09:00")).toBe(false);
    });

    it("handles midnight-wrapping windows", () => {
      // 22:00-04:00 window; 23:00 is inside, 03:00 is inside, 12:00 is outside
      expect(inWindow(new Date("2026-03-01T23:00:00Z"), "22:00", "04:00")).toBe(true);
      expect(inWindow(new Date("2026-03-02T03:00:00Z"), "22:00", "04:00")).toBe(true);
      expect(inWindow(new Date("2026-03-02T12:00:00Z"), "22:00", "04:00")).toBe(false);
    });
  });

  describe("normalizeEventType", () => {
    it("maps known raw types to canonical event types", () => {
      expect(normalizeEventType("check-in")).toBe("CHECK_IN");
      expect(normalizeEventType("CHECK_IN")).toBe("CHECK_IN");
      expect(normalizeEventType("check-out")).toBe("CHECK_OUT");
      expect(normalizeEventType("fingerprint")).toBe("FINGERPRINT_VERIFIED");
      expect(normalizeEventType("presence")).toBe("PRESENCE");
    });

    it("falls back to PRESENCE for unknown types", () => {
      expect(normalizeEventType("unknown_device_event")).toBe("PRESENCE");
      expect(normalizeEventType(null)).toBe("PRESENCE");
      expect(normalizeEventType(undefined)).toBe("PRESENCE");
      expect(normalizeEventType("")).toBe("PRESENCE");
    });
  });

  describe("dedupKeyFor", () => {
    it("produces a stable key per project, window, operational date, and person", () => {
      const key1 = dedupKeyFor("proj-1", "win-1", "2026-03-01", "person-001");
      const key2 = dedupKeyFor("proj-1", "win-1", "2026-03-01", "person-001");
      expect(key1).toBe(key2);
      expect(key1).toBe("proj-1:2026-03-01:win-1:person-001");
    });

    it("uses 'nowin' when window is null", () => {
      expect(dedupKeyFor("proj-1", null, "2026-03-01", "person-001")).toBe(
        "proj-1:2026-03-01:nowin:person-001",
      );
    });

    it("differs across persons and days and windows", () => {
      expect(dedupKeyFor("proj-1", "win-1", "2026-03-01", "person-001")).not.toBe(
        dedupKeyFor("proj-1", "win-1", "2026-03-01", "person-002"),
      );
      expect(dedupKeyFor("proj-1", "win-1", "2026-03-01", "person-001")).not.toBe(
        dedupKeyFor("proj-1", "win-1", "2026-03-02", "person-001"),
      );
      expect(dedupKeyFor("proj-1", "win-1", "2026-03-01", "person-001")).not.toBe(
        dedupKeyFor("proj-1", "win-2", "2026-03-01", "person-001"),
      );
    });
  });

  describe("eventEstablishesPresence", () => {
    it("returns true for presence-establishing event types", () => {
      expect(eventEstablishesPresence("CHECK_IN")).toBe(true);
      expect(eventEstablishesPresence("CHECK_OUT")).toBe(true);
      expect(eventEstablishesPresence("FINGERPRINT_VERIFIED")).toBe(true);
      expect(eventEstablishesPresence("PRESENCE")).toBe(true);
    });
  });

  describe("overallCoverage", () => {
    it("returns UNAVAILABLE when no sources contribute", () => {
      expect(overallCoverage([])).toBe("UNAVAILABLE");
      expect(
        overallCoverage([
          { source: "BIOMETRIC" as AttendanceSource, coverage: "UNAVAILABLE" },
        ]),
      ).toBe("UNAVAILABLE");
    });

    it("returns INSUFFICIENT if any source is insufficient", () => {
      expect(
        overallCoverage([
          { source: "BIOMETRIC" as AttendanceSource, coverage: "COMPLETE" },
          { source: "CCTV" as AttendanceSource, coverage: "INSUFFICIENT" },
        ]),
      ).toBe("INSUFFICIENT");
    });

    it("returns PARTIAL if any source is partial (and none insufficient)", () => {
      expect(
        overallCoverage([
          { source: "BIOMETRIC" as AttendanceSource, coverage: "COMPLETE" },
          { source: "CCTV" as AttendanceSource, coverage: "PARTIAL" },
        ]),
      ).toBe("PARTIAL");
    });

    it("returns COMPLETE when all sources are complete", () => {
      expect(
        overallCoverage([
          { source: "BIOMETRIC" as AttendanceSource, coverage: "COMPLETE" },
          { source: "INSTITUTION_REPORTED" as AttendanceSource, coverage: "COMPLETE" },
        ]),
      ).toBe("COMPLETE");
    });
  });

  describe("assessDataQuality", () => {
    it("returns POOR when coverage is unavailable or insufficient", () => {
      expect(assessDataQuality({ coverage: "UNAVAILABLE", duplicateRate: 0, unmatchedCount: 0, invalidCount: 0, stale: false })).toBe("POOR");
      expect(assessDataQuality({ coverage: "INSUFFICIENT", duplicateRate: 0, unmatchedCount: 0, invalidCount: 0, stale: false })).toBe("POOR");
    });

    it("returns DEGRADED when stale, high duplicate rate, or unmatched/invalid events", () => {
      expect(assessDataQuality({ coverage: "COMPLETE", duplicateRate: 0, unmatchedCount: 0, invalidCount: 0, stale: true })).toBe("DEGRADED");
      expect(assessDataQuality({ coverage: "COMPLETE", duplicateRate: 0.4, unmatchedCount: 0, invalidCount: 0, stale: false })).toBe("DEGRADED");
      expect(assessDataQuality({ coverage: "COMPLETE", duplicateRate: 0, unmatchedCount: 1, invalidCount: 0, stale: false })).toBe("DEGRADED");
      expect(assessDataQuality({ coverage: "COMPLETE", duplicateRate: 0, unmatchedCount: 0, invalidCount: 1, stale: false })).toBe("DEGRADED");
      expect(assessDataQuality({ coverage: "PARTIAL", duplicateRate: 0, unmatchedCount: 0, invalidCount: 0, stale: false })).toBe("DEGRADED");
    });

    it("returns GOOD when coverage is complete and data is clean", () => {
      expect(assessDataQuality({ coverage: "COMPLETE", duplicateRate: 0, unmatchedCount: 0, invalidCount: 0, stale: false })).toBe("GOOD");
    });
  });

  describe("calculateAttendance", () => {
    it("counts unique present events", () => {
      const presentEvents: AttendanceEvent[] = Array.from({ length: 15 }, (_, i) => ({
        id: `e-${i}`,
        projectId: "p1",
        deviceId: "d1",
        populationId: null,
        personExternalId: `p${i}`,
        netramUserId: null,
        eventType: "PRESENCE" as AttendanceEventType,
        occurredAt: "2026-03-01T08:00:00Z",
        receivedAt: "2026-03-01T08:00:00Z",
        rawTransactionId: `rt-${i}`,
        windowId: null,
        operationalDate: null,
        dedupKey: `dk-${i}`,
        status: "NORMALIZED" as const,
      }));
      const result = calculateAttendance({
        window: { id: "w1", projectId: "p1", code: "M", name: "Morning", startTime: "06:00", endTime: "09:00", populationId: null, minCoverage: 0.5, config: {}, createdAt: "2026-01-01T00:00:00Z" },
        expected: 15,
        presentEvents,
        sourceCounts: { BIOMETRIC: 15, INSTITUTION_REPORTED: 0, CCTV: 0, MANUAL: 0 },
        sourceCoverage: [{ source: "BIOMETRIC" as AttendanceSource, coverage: "COMPLETE" }],
        freshness: new Date(),
        duplicateRate: null,
        unmatchedCount: 0,
        invalidCount: 0,
        stale: false,
        policy: {},
      });
      expect(result.present).toBe(15);
    });

    it("counts present events passed to it (dedup happens at service layer)", () => {
      const presentEvents: AttendanceEvent[] = [
        { id: "e1", projectId: "p1", deviceId: "d1", populationId: null, personExternalId: "p1", netramUserId: null, eventType: "PRESENCE" as AttendanceEventType, occurredAt: "2026-03-01T08:00:00Z", receivedAt: "2026-03-01T08:00:00Z", rawTransactionId: "rt1", windowId: null, operationalDate: null, dedupKey: "same-key", status: "NORMALIZED" as const },
        { id: "e2", projectId: "p1", deviceId: "d1", populationId: null, personExternalId: "p1", netramUserId: null, eventType: "CHECK_IN" as AttendanceEventType, occurredAt: "2026-03-01T08:00:00Z", receivedAt: "2026-03-01T08:00:00Z", rawTransactionId: "rt2", windowId: null, operationalDate: null, dedupKey: "same-key", status: "NORMALIZED" as const },
        { id: "e3", projectId: "p1", deviceId: "d1", populationId: null, personExternalId: "p2", netramUserId: null, eventType: "PRESENCE" as AttendanceEventType, occurredAt: "2026-03-01T08:00:00Z", receivedAt: "2026-03-01T08:00:00Z", rawTransactionId: "rt3", windowId: null, operationalDate: null, dedupKey: "other-key", status: "NORMALIZED" as const },
      ];
      const result = calculateAttendance({
        window: { id: "w1", projectId: "p1", code: "M", name: "Morning", startTime: "06:00", endTime: "09:00", populationId: null, minCoverage: 0.5, config: {}, createdAt: "2026-01-01T00:00:00Z" },
        expected: 3,
        presentEvents,
        sourceCounts: { BIOMETRIC: 3, INSTITUTION_REPORTED: 0, CCTV: 0, MANUAL: 0 },
        sourceCoverage: [{ source: "BIOMETRIC" as AttendanceSource, coverage: "COMPLETE" }],
        freshness: new Date(),
        duplicateRate: null,
        unmatchedCount: 0,
        invalidCount: 0,
        stale: false,
        policy: {},
      });
      // calculateAttendance counts events as-is; dedup is done upstream in the service
      expect(result.present).toBe(3);
    });

    it("counts present events without dedupKey", () => {
      const presentEvents: AttendanceEvent[] = [
        { id: "e1", projectId: "p1", deviceId: "d1", populationId: null, personExternalId: "p1", netramUserId: null, eventType: "PRESENCE" as AttendanceEventType, occurredAt: "2026-03-01T08:00:00Z", receivedAt: "2026-03-01T08:00:00Z", rawTransactionId: "rt1", windowId: null, operationalDate: null, dedupKey: null, status: "NORMALIZED" as const },
        { id: "e2", projectId: "p1", deviceId: "d1", populationId: null, personExternalId: "p2", netramUserId: null, eventType: "PRESENCE" as AttendanceEventType, occurredAt: "2026-03-01T08:00:00Z", receivedAt: "2026-03-01T08:00:00Z", rawTransactionId: "rt2", windowId: null, operationalDate: null, dedupKey: null, status: "NORMALIZED" as const },
      ];
      const result = calculateAttendance({
        window: { id: "w1", projectId: "p1", code: "M", name: "Morning", startTime: "06:00", endTime: "09:00", populationId: null, minCoverage: 0.5, config: {}, createdAt: "2026-01-01T00:00:00Z" },
        expected: 2,
        presentEvents,
        sourceCounts: { BIOMETRIC: 2, INSTITUTION_REPORTED: 0, CCTV: 0, MANUAL: 0 },
        sourceCoverage: [{ source: "BIOMETRIC" as AttendanceSource, coverage: "COMPLETE" }],
        freshness: new Date(),
        duplicateRate: null,
        unmatchedCount: 0,
        invalidCount: 0,
        stale: false,
        policy: {},
      });
      expect(result.present).toBe(2);
    });

    it("computes absent only under complete coverage", () => {
      const resultComplete = calculateAttendance({
        window: { id: "w1", projectId: "p1", code: "M", name: "Morning", startTime: "06:00", endTime: "09:00", populationId: null, minCoverage: 0.5, config: {}, createdAt: "2026-01-01T00:00:00Z" },
        expected: 10,
        presentEvents: [],
        sourceCounts: { BIOMETRIC: 0, INSTITUTION_REPORTED: 0, CCTV: 0, MANUAL: 0 },
        sourceCoverage: [{ source: "BIOMETRIC" as AttendanceSource, coverage: "COMPLETE" }],
        freshness: new Date(),
        duplicateRate: null,
        unmatchedCount: 0,
        invalidCount: 0,
        stale: false,
        policy: {},
      });
      expect(resultComplete.absent).toBe(10);
      expect(resultComplete.unknown).toBe(0);

      // partial coverage: absent is null, unknown = expected - present
      const resultPartial2 = calculateAttendance({
        window: { id: "w1", projectId: "p1", code: "M", name: "Morning", startTime: "06:00", endTime: "09:00", populationId: null, minCoverage: 0.5, config: {}, createdAt: "2026-01-01T00:00:00Z" },
        expected: 10,
        presentEvents: [],
        sourceCounts: { BIOMETRIC: 0, INSTITUTION_REPORTED: 0, CCTV: 0, MANUAL: 0 },
        sourceCoverage: [{ source: "BIOMETRIC" as AttendanceSource, coverage: "PARTIAL" }],
        freshness: new Date(),
        duplicateRate: null,
        unmatchedCount: 0,
        invalidCount: 0,
        stale: false,
        policy: {},
      });
      expect(resultPartial2.absent).toBeNull();
      expect(resultPartial2.unknown).toBe(10);
    });

    it("handles events without dedupKey (falls back to id)", () => {
      const presentEvents = [
        { id: "e1", projectId: "p1", deviceId: "d1", populationId: null, personExternalId: "p1", netramUserId: null, eventType: "PRESENCE" as AttendanceEventType, occurredAt: "2026-03-01T08:00:00Z", receivedAt: "2026-03-01T08:00:00Z", rawTransactionId: "rt1", windowId: null, operationalDate: null, dedupKey: null, status: "NORMALIZED" as const },
        { id: "e2", projectId: "p1", deviceId: "d1", populationId: null, personExternalId: "p2", netramUserId: null, eventType: "PRESENCE" as AttendanceEventType, occurredAt: "2026-03-01T08:00:00Z", receivedAt: "2026-03-01T08:00:00Z", rawTransactionId: "rt2", windowId: null, operationalDate: null, dedupKey: null, status: "NORMALIZED" as const },
      ];
      // dedup fallback uses e.id when dedupKey is falsy; both have different ids → 2 present
      const result = calculateAttendance({
        window: { id: "w1", projectId: "p1", code: "M", name: "Morning", startTime: "06:00", endTime: "09:00", populationId: null, minCoverage: 0.5, config: {}, createdAt: "2026-01-01T00:00:00Z" },
        expected: 2,
        presentEvents,
        sourceCounts: { BIOMETRIC: 2, INSTITUTION_REPORTED: 0, CCTV: 0, MANUAL: 0 },
        sourceCoverage: [{ source: "BIOMETRIC" as AttendanceSource, coverage: "COMPLETE" }],
        freshness: new Date(),
        duplicateRate: null,
        unmatchedCount: 0,
        invalidCount: 0,
        stale: false,
        policy: {},
      });
      expect(result.present).toBe(2);
    });

    it("handles null expected population", () => {
      const result = calculateAttendance({
        window: { id: "w1", projectId: "p1", code: "M", name: "Morning", startTime: "06:00", endTime: "09:00", populationId: null, minCoverage: 0.5, config: {}, createdAt: "2026-01-01T00:00:00Z" },
        expected: null,
        presentEvents: [],
        sourceCounts: { BIOMETRIC: 0, INSTITUTION_REPORTED: 0, CCTV: 0, MANUAL: 0 },
        sourceCoverage: [{ source: "BIOMETRIC" as AttendanceSource, coverage: "COMPLETE" }],
        freshness: new Date(),
        duplicateRate: null,
        unmatchedCount: 0,
        invalidCount: 0,
        stale: false,
        policy: {},
      });
      expect(result.expected).toBeNull();
      expect(result.absent).toBeNull();
      expect(result.unknown).toBe(0);
    });
  });
});
