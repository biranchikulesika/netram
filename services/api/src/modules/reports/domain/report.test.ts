import { describe, expect, it } from "vitest";
import { evaluateReportTransition, InvalidReportTransitionError } from "./report.js";

describe("evaluateReportTransition", () => {
  it("allows the generation and immutable finalize lifecycle", () => {
    expect(evaluateReportTransition("requested", "generating").to).toBe("generating");
    expect(evaluateReportTransition("generating", "ready").to).toBe("ready");
    expect(evaluateReportTransition("generating", "failed").to).toBe("failed");
    expect(evaluateReportTransition("failed", "generating").to).toBe("generating");
    expect(evaluateReportTransition("ready", "finalized").to).toBe("finalized");
  });

  it("rejects skipping states, retrying finalized reports, and mutating finalized ones", () => {
    expect(() => evaluateReportTransition("requested", "ready")).toThrow(
      InvalidReportTransitionError,
    );
    expect(() => evaluateReportTransition("requested", "finalized")).toThrow(
      InvalidReportTransitionError,
    );
    expect(() => evaluateReportTransition("ready", "generating")).toThrow(
      InvalidReportTransitionError,
    );
    expect(() => evaluateReportTransition("finalized", "generating")).toThrow(
      InvalidReportTransitionError,
    );
    expect(() => evaluateReportTransition("finalized", "ready")).toThrow(
      InvalidReportTransitionError,
    );
  });
});
