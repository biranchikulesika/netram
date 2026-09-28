import { describe, expect, it } from "vitest";
import { gradientOffset, rampColor } from "./health-gauge";

/** The three stops the SVG track is painted with, in gradient-axis offsets. */
const STOP_LOW = { offset: 0, color: "#dc2626" } as const;
const STOP_MID = { offset: gradientOffset(50), color: "#dd501e" } as const;
const STOP_HIGH = { offset: 1, color: "#137e3a" } as const;

function channels(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

/** How SVG interpolates a linearGradient: by offset along the axis, not by score. */
function trackColorAt(score: number): string {
  const at = gradientOffset(score);
  const [lower, upper] = at <= STOP_MID.offset ? [STOP_LOW, STOP_MID] : [STOP_MID, STOP_HIGH];
  const t = (at - lower.offset) / (upper.offset - lower.offset);
  const [r0, g0, b0] = channels(lower.color);
  const [r1, g1, b1] = channels(upper.color);
  const blend = (a: number, b: number) =>
    Math.round(a + (b - a) * t).toString(16).padStart(2, "0");
  return `#${blend(r0, r1)}${blend(g0, g1)}${blend(b0, b1)}`;
}

describe("health gauge colour ramp", () => {
  // Regression: the needle/hub once used a stepped palette while the track used a
  // continuous gradient, so one score rendered in two or three hues at once.
  it("agrees with the track gradient at every score", () => {
    for (let score = 0; score <= 100; score += 1) {
      expect(rampColor(score), `score ${score}`).toBe(trackColorAt(score));
    }
  });

  it("puts the ramp's landmarks on the arc's own score positions", () => {
    expect(gradientOffset(0)).toBe(0);
    expect(gradientOffset(50)).toBeCloseTo(0.5, 6);
    expect(gradientOffset(100)).toBe(1);
  });

  it("runs red at 0 through amber at 50 to green at 100", () => {
    expect(rampColor(0)).toBe("#dc2626");
    expect(rampColor(50)).toBe("#dd501e");
    expect(rampColor(100)).toBe("#137e3a");
  });

  it("rises monotonically, so higher health is never a duller colour", () => {
    let previous = Number.NEGATIVE_INFINITY;
    for (let score = 0; score <= 100; score += 1) {
      const [r, g] = channels(rampColor(score));
      const greenness = g - r;
      expect(greenness, `score ${score}`).toBeGreaterThanOrEqual(previous);
      previous = greenness;
    }
  });
});
