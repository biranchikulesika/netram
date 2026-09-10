import { describe, expect, it } from "vitest";
import {
  evaluateNotificationTransition,
  InvalidNotificationTransitionError,
} from "./notification.js";

describe("evaluateNotificationTransition", () => {
  it("allows pending -> read", () => {
    expect(evaluateNotificationTransition("pending", "read")).toEqual({ to: "read" });
  });

  it("rejects read -> pending", () => {
    expect(() => evaluateNotificationTransition("read", "pending")).toThrow(
      InvalidNotificationTransitionError,
    );
  });

  it("rejects read -> read", () => {
    expect(() => evaluateNotificationTransition("read", "read")).toThrow(
      InvalidNotificationTransitionError,
    );
  });
});
