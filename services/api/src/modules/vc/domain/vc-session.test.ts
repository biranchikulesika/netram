import { describe, it, expect } from "vitest";
import {
  validateVcTransition,
  InvalidVcSessionTransitionError,
  isSessionJoinable,
  determineParticipantRole,
} from "./vc-session.js";

describe("VC Session Domain Model", () => {
  describe("validateVcTransition", () => {
    it("allows scheduled -> active", () => {
      expect(() => validateVcTransition("scheduled", "active")).not.toThrow();
    });

    it("allows scheduled -> cancelled", () => {
      expect(() => validateVcTransition("scheduled", "cancelled")).not.toThrow();
    });

    it("allows active -> completed", () => {
      expect(() => validateVcTransition("active", "completed")).not.toThrow();
    });

    it("rejects invalid transitions", () => {
      expect(() => validateVcTransition("completed", "active")).toThrow(
        InvalidVcSessionTransitionError,
      );
      expect(() => validateVcTransition("cancelled", "active")).toThrow(
        InvalidVcSessionTransitionError,
      );
      expect(() => validateVcTransition("active", "scheduled")).toThrow(
        InvalidVcSessionTransitionError,
      );
    });
  });

  describe("isSessionJoinable", () => {
    it("permits joining scheduled and active sessions", () => {
      expect(isSessionJoinable("scheduled")).toBe(true);
      expect(isSessionJoinable("active")).toBe(true);
      expect(isSessionJoinable("completed")).toBe(false);
      expect(isSessionJoinable("cancelled")).toBe(false);
    });
  });

  describe("determineParticipantRole", () => {
    it("assigns host role if userId matches hostUserId", () => {
      const role = determineParticipantRole("user-1", "user-1", "observer");
      expect(role).toBe("host");
    });

    it("honors requested role when not host", () => {
      const role = determineParticipantRole("user-2", "user-1", "inspector");
      expect(role).toBe("inspector");
    });

    it("defaults to observer if no role specified or implied", () => {
      const role = determineParticipantRole("user-3", "user-1");
      expect(role).toBe("observer");
    });
  });
});
