import { describe, it, expect, beforeEach } from "vitest";
import {
  startCallingSound,
  stopCallingSound,
  playCallPickupSound,
  stopAllCallSounds,
} from "./call-sounds";

describe("Call Sounds Utility", () => {
  beforeEach(() => {
    stopAllCallSounds();
  });

  it("starts and stops calling ringtone without error", async () => {
    await expect(startCallingSound()).resolves.toBeUndefined();
    expect(() => stopCallingSound()).not.toThrow();
  });

  it("plays call pickup chime without error", async () => {
    await expect(playCallPickupSound()).resolves.toBeUndefined();
  });

  it("stops all call sounds cleanly", () => {
    expect(() => stopAllCallSounds()).not.toThrow();
  });
});
