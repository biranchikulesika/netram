import { describe, expect, it } from "vitest";
import { evaluateAiAnomalyTransition, InvalidAiAnomalyTransitionError } from "./ai-anomaly.js";

describe("evaluateAiAnomalyTransition", () => {
  it("allows the advisory review lifecycle", () => {
    expect(evaluateAiAnomalyTransition("new", "reviewed").to).toBe("reviewed");
    expect(evaluateAiAnomalyTransition("new", "dismissed").to).toBe("dismissed");
    expect(evaluateAiAnomalyTransition("reviewed", "investigated").to).toBe("investigated");
    expect(evaluateAiAnomalyTransition("reviewed", "acted_upon").to).toBe("acted_upon");
    expect(evaluateAiAnomalyTransition("investigated", "acted_upon").to).toBe("acted_upon");
  });

  it("rejects acting on un-reviewed anomalies and mutations of terminal states", () => {
    expect(() => evaluateAiAnomalyTransition("new", "acted_upon")).toThrow(
      InvalidAiAnomalyTransitionError,
    );
    expect(() => evaluateAiAnomalyTransition("new", "investigated")).toThrow(
      InvalidAiAnomalyTransitionError,
    );
    expect(() => evaluateAiAnomalyTransition("dismissed", "reviewed")).toThrow(
      InvalidAiAnomalyTransitionError,
    );
    expect(() => evaluateAiAnomalyTransition("acted_upon", "investigated")).toThrow(
      InvalidAiAnomalyTransitionError,
    );
  });
});
