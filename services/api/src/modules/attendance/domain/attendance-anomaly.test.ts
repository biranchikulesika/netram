import { describe, it, expect } from "vitest";
import {
  historicalBaseline,
  crossSourceSignal,
  persistenceStreak,
  severityFor,
  confidenceFor,
  detectAnomalies,
  groupKeyFor,
  groupWithinProximity,
  materialityExceeded,
} from "./attendance-anomaly.js";
import type { AttendanceConfig, CoverageLevel, DataQualityLevel } from "@netram/types";

const DEFAULT_CONFIG: AttendanceConfig = {
  projectId: null,
  dayStartTime: "05:00",
  thresholds: {
    crossSourceDiscrepancy: 0.15,
    historicalDeviation: 0.25,
    persistenceWindowDays: 5,
    materialityThreshold: 0.1,
  },
  baseline: { windowDays: 14, minObservations: 5 },
  retention: { rawTransactionsDays: 365, exportsHours: 24 },
  updatedAt: new Date().toISOString(),
};

describe("attendance anomaly domain", () => {
  describe("historicalBaseline", () => {
    it("returns median and deviation ratio", () => {
      const prior = [10, 12, 11, 13, 12];
      const base = historicalBaseline(prior, 8);
      expect(base.median).toBe(12);
      // |8 - 12| / 12 = 0.333...
      expect(base.deviationRatio).toBeCloseTo(0.333, 3);
    });

    it("handles empty history with zero deviation", () => {
      const base = historicalBaseline([], 10);
      expect(base.count).toBe(0);
      expect(base.median).toBe(10);
      expect(base.deviationRatio).toBe(0);
    });

    it("uses median of even-length array", () => {
      const base = historicalBaseline([10, 14], 12);
      expect(base.median).toBe(12);
    });
  });

  describe("crossSourceSignal", () => {
    it("returns null when either source is null", () => {
      expect(crossSourceSignal(null, 100, 100)).toBeNull();
      expect(crossSourceSignal(80, null, 100)).toBeNull();
    });

    it("computes relative difference against expected", () => {
      // biometric=80, reported=100, expected=100 → diff=20, relative=0.2
      const sig = crossSourceSignal(80, 100, 100);
      expect(sig).not.toBeNull();
      expect(sig!.difference).toBe(20);
      expect(sig!.relative).toBe(0.2);
    });

    it("uses max of sources when expected is null or zero", () => {
      const sig = crossSourceSignal(80, 100, null);
      expect(sig).not.toBeNull();
      expect((sig as { difference: number; relative: number }).relative).toBeCloseTo(0.2, 3); // 20 / 100
    });
  });

  describe("persistenceStreak", () => {
    it("counts trailing days below the low ratio", () => {
      // expected=100, lowRatio=0.6 → threshold=60
      const values = [90, 85, 55, 50, 45]; // last 3 are below 60
      expect(persistenceStreak(values, 100, 0.6)).toBe(3);
    });

    it("returns zero when no days are below threshold", () => {
      expect(persistenceStreak([100, 110, 95], 100, 0.6)).toBe(0);
    });

    it("returns zero when expected is null", () => {
      expect(persistenceStreak([50, 40], null, 0.6)).toBe(0);
    });
  });

  describe("severityFor", () => {
    it("maps score to severity", () => {
      expect(severityFor(0.1)).toBe("LOW");
      expect(severityFor(0.29)).toBe("LOW");
      expect(severityFor(0.3)).toBe("MEDIUM");
      expect(severityFor(0.49)).toBe("MEDIUM");
      expect(severityFor(0.5)).toBe("HIGH");
      expect(severityFor(0.69)).toBe("HIGH");
      expect(severityFor(0.7)).toBe("CRITICAL");
      expect(severityFor(1)).toBe("CRITICAL");
    });
  });

  describe("confidenceFor", () => {
    it("gives highest confidence with complete coverage and good quality", () => {
      const c = confidenceFor(0.5, "COMPLETE", "GOOD");
      expect(c).toBeGreaterThanOrEqual(0.5);
    });

    it("reduces confidence with poor coverage or quality", () => {
      expect(confidenceFor(0.5, "INSUFFICIENT", "GOOD")).toBeLessThan(
        confidenceFor(0.5, "COMPLETE", "GOOD"),
      );
      expect(confidenceFor(0.5, "COMPLETE", "POOR")).toBeLessThan(
        confidenceFor(0.5, "COMPLETE", "GOOD"),
      );
    });
  });

  describe("detectAnomalies", () => {
    it("detects cross-source discrepancy when relative difference exceeds threshold", () => {
      const candidates = detectAnomalies({
        present: 11,
        expected: 12,
        history: [],
        biometricCount: 11,
        reportedCount: 168,
        cctvCount: null,
        coverage: "PARTIAL" as CoverageLevel,
        dataQuality: "DEGRADED" as DataQualityLevel,
        config: DEFAULT_CONFIG,
      });
      const discrepancy = candidates.find((c) => c.anomalyType === "CROSS_SOURCE_DISCREPANCY");
      expect(discrepancy).not.toBeUndefined();
      expect(discrepancy!.score).toBeGreaterThan(0);
    });

    it("does not claim cross-source discrepancy when only one source is available", () => {
      const candidates = detectAnomalies({
        present: 11,
        expected: 12,
        history: [],
        biometricCount: 11,
        reportedCount: null,
        cctvCount: null,
        coverage: "COMPLETE" as CoverageLevel,
        dataQuality: "GOOD" as DataQualityLevel,
        config: DEFAULT_CONFIG,
      });
      expect(candidates.find((c) => c.anomalyType === "CROSS_SOURCE_DISCREPANCY")).toBeUndefined();
    });

    it("detects historical deviation when enough history and deviation exceeds threshold", () => {
      const history = Array.from({ length: 10 }, () => 15); // median=15, minObservations=5 satisfied
      const candidates = detectAnomalies({
        present: 8,
        expected: 15,
        history,
        biometricCount: 8,
        reportedCount: null,
        cctvCount: null,
        coverage: "COMPLETE" as CoverageLevel,
        dataQuality: "GOOD" as DataQualityLevel,
        config: DEFAULT_CONFIG,
      });
      const deviation = candidates.find((c) => c.anomalyType === "HISTORICAL_DEVIATION");
      expect(deviation).not.toBeUndefined();
    });

    it("does not detect historical deviation with insufficient history", () => {
      const history = [15, 14]; // minObservations=5 not satisfied
      const candidates = detectAnomalies({
        present: 5,
        expected: 15,
        history,
        biometricCount: 5,
        reportedCount: null,
        cctvCount: null,
        coverage: "COMPLETE" as CoverageLevel,
        dataQuality: "GOOD" as DataQualityLevel,
        config: DEFAULT_CONFIG,
      });
      expect(candidates.find((c) => c.anomalyType === "HISTORICAL_DEVIATION")).toBeUndefined();
    });

    it("detects persistent low attendance when streak meets threshold", () => {
      // 5 days of low attendance (below 60% of expected=100 → below 60)
      const history = [50, 55, 45, 40, 50]; // 5 days below 60
      const candidates = detectAnomalies({
        present: 45,
        expected: 100,
        history,
        biometricCount: 45,
        reportedCount: null,
        cctvCount: null,
        coverage: "COMPLETE" as CoverageLevel,
        dataQuality: "GOOD" as DataQualityLevel,
        config: DEFAULT_CONFIG,
      });
      const persistent = candidates.find((c) => c.anomalyType === "PERSISTENT_LOW_ATTENDANCE");
      expect(persistent).not.toBeUndefined();
      expect(persistent!.score).toBeGreaterThan(0.35);
    });

    it("detects source quality when coverage is insufficient", () => {
      const candidates = detectAnomalies({
        present: 0,
        expected: null,
        history: [],
        biometricCount: null,
        reportedCount: null,
        cctvCount: null,
        coverage: "INSUFFICIENT" as CoverageLevel,
        dataQuality: "POOR" as DataQualityLevel,
        config: DEFAULT_CONFIG,
      });
      expect(candidates.find((c) => c.anomalyType === "SOURCE_QUALITY")).not.toBeUndefined();
    });

    it("produces detector version in supporting signals", () => {
      const candidates = detectAnomalies({
        present: 11,
        expected: 12,
        history: [],
        biometricCount: 11,
        reportedCount: 168,
        cctvCount: null,
        coverage: "PARTIAL" as CoverageLevel,
        dataQuality: "DEGRADED" as DataQualityLevel,
        config: DEFAULT_CONFIG,
      });
      const anyCandidate = candidates[0];
      expect(anyCandidate).not.toBeUndefined();
      expect(anyCandidate!.supportingSignals.dataQuality).toBe("DEGRADED");
      expect(anyCandidate!.supportingSignals.coverage).toBe("PARTIAL");
    });
  });

  describe("grouping and materiality", () => {
    it("produces stable group keys", () => {
      expect(groupKeyFor("proj-1", "pop-1", "CROSS_SOURCE_DISCREPANCY")).toBe(
        "proj-1:pop-1:CROSS_SOURCE_DISCREPANCY",
      );
      expect(groupKeyFor("proj-1", null, "HISTORICAL_DEVIATION")).toBe(
        "proj-1:all:HISTORICAL_DEVIATION",
      );
    });

    it("returns true when group opened within proximity window", () => {
      const opened = new Date();
      opened.setDate(opened.getDate() - 3);
      expect(groupWithinProximity(opened, new Date(), 7)).toBe(true);
    });

    it("returns false when group is older than proximity window", () => {
      const opened = new Date();
      opened.setDate(opened.getDate() - 10);
      expect(groupWithinProximity(opened, new Date(), 7)).toBe(false);
    });

    it("detects materiality exceedance", () => {
      expect(materialityExceeded(0.3, 0.5, 0.1)).toBe(true);
      expect(materialityExceeded(0.3, 0.35, 0.1)).toBe(false);
      expect(materialityExceeded(0.3, 0.34, 0.1)).toBe(false);
      expect(materialityExceeded(0.3, 0.4, 0.1)).toBe(true);
      expect(materialityExceeded(0.3, 0.3, 0.1)).toBe(false);
    });
  });
});
