import { describe, expect, it } from "vitest";
import type { AuditEvent } from "@netram/types";
import {
  actorSide,
  categoryForAction,
  formatAuditActivity,
  matchesTimeRange,
  resolveActor,
} from "./audit-activity";

const OFFICER = "dce6caae-1730-5259-8331-8232d33c6030"; // authority_officer (Khordha)
const INSTITUTION = "07806a3a-4951-5ee7-a56b-905ef915de9f"; // institution_admin (Vani Vihar)
const VANI = "f2e4fac4-8505-5877-b483-5c6acf76dcc0"; // Vani Vihar SC/ST Hostel

function evt(partial: Partial<AuditEvent>): AuditEvent {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    action: "project.created",
    actorUserId: OFFICER,
    resourceType: "project",
    resourceId: VANI,
    requestId: "req-1",
    ipAddress: "127.0.0.1",
    metadata: {},
    occurredAt: "2026-09-24T05:12:00.000Z",
    ...partial,
  };
}

describe("formatAuditActivity", () => {
  it("renders a contextual project creation summary", () => {
    const a = formatAuditActivity(evt({ action: "project.created" }));
    expect(a.summary).toBe("New project registered for Vani Vihar SC/ST Hostel");
    expect(a.category).toBe("facilities");
  });

  it("renders inspection summaries with the facility", () => {
    const a = formatAuditActivity(
      evt({ action: "inspection.started" as AuditEvent["action"], metadata: { surprise: true } }),
    );
    expect(a.summary).toBe("Inspection started at Vani Vihar SC/ST Hostel");
  });

  it("renders report submission naturally", () => {
    const a = formatAuditActivity(
      evt({ action: "inspection.submitted" as AuditEvent["action"], metadata: { code: "INS-1" } }),
    );
    expect(a.summary).toBe("Inspection report submitted for Vani Vihar SC/ST Hostel");
    expect(a.context.some((c) => c.label === "Reference" && c.value === "INS-1")).toBe(true);
  });

  it("renders a readable status transition", () => {
    const a = formatAuditActivity(
      evt({ action: "project.transitioned", metadata: { from: "pending_verification", to: "approved" } }),
    );
    expect(a.summary).toBe("Project status updated to Approved");
    expect(a.transition).toBe("Pending Verification → Approved");
    expect(a.detail).toContain("from Pending Verification to Approved");
  });

  it("keeps CCTV access officer-friendly and hides technical depth", () => {
    const a = formatAuditActivity(
      evt({
        action: "cctv.accessed",
        resourceType: "cctv_camera",
        resourceId: "a8ccb317-76ab-5106-ac47-5bc1dc568967",
        metadata: {
          cameraId: "a8ccb317-76ab-5106-ac47-5bc1dc568967",
          streamId: "s-1",
          mediaPath: "facility-vani/cam-gate",
          expiresAt: "2026-09-24T05:20:00Z",
        },
      }),
    );
    expect(a.summary).toBe("CCTV stream accessed");
    expect(a.context.some((c) => c.label === "Stream path")).toBe(true);
    expect(a.summary).not.toMatch(/mediaPath|streamId/);
  });

  it("explains denied media authorisations without leaking tokens", () => {
    const a = formatAuditActivity(
      evt({
        action: "cctv.media_auth_denied",
        actorUserId: null,
        metadata: { reason: "token_expired", action: "read", path: "facility-vani/cam-gate", protocol: "webrtc" },
      }),
    );
    expect(a.summary).toBe("Blocked an unauthorized stream request");
    expect(a.detail).toContain("token expired");
    expect(a.tone).toBe("critical");
  });

  it("renders complaint activity with tracking code", () => {
    const a = formatAuditActivity(
      evt({ action: "complaint.submitted", metadata: { trackingCode: "CMP-7", attachmentCount: 2 } }),
    );
    expect(a.summary).toBe("Complaint submitted for Vani Vihar SC/ST Hostel");
    expect(a.detail).toContain("2 attachments");
    expect(a.context.some((c) => c.value === "CMP-7")).toBe(true);
  });

  it("uses an honest fallback for unknown actions", () => {
    const a = formatAuditActivity(
      evt({ action: "brand_new.thing_happened" as AuditEvent["action"], metadata: null }),
    );
    expect(a.summary).toBe("Thing Happened");
    expect(a.status).toBe("Recorded");
  });
});

describe("resolveActor / actorSide", () => {
  it("treats an institution account as the institution itself", () => {
    const actor = resolveActor(evt({ actorUserId: INSTITUTION }));
    expect(actor?.isInstitution).toBe(true);
    expect(actor?.role).toBe("Institution Account");
    expect(actorSide(evt({ actorUserId: INSTITUTION }))).toBe("Institute");
  });

  it("treats an officer account as authority personnel", () => {
    const actor = resolveActor(evt({ actorUserId: OFFICER }));
    expect(actor?.isInstitution).toBe(false);
    expect(actor?.role).toBe("Authority Officer");
    expect(actor?.account).toContain("Sruti");
    expect(actorSide(evt({ actorUserId: OFFICER }))).toBe("Authority");
  });

  it("returns null for system-driven events", () => {
    expect(resolveActor(evt({ actorUserId: null }))).toBeNull();
  });
});

describe("categoryForAction", () => {
  it("maps the main event families", () => {
    expect(categoryForAction("inspection.started")).toBe("inspections");
    expect(categoryForAction("corrective_action.submitted")).toBe("remediations");
    expect(categoryForAction("complaint.resolved")).toBe("grievances");
    expect(categoryForAction("project.approved")).toBe("facilities");
    expect(categoryForAction("auth.authorization_failed")).toBe("security");
    expect(categoryForAction("cctv.accessed")).toBe("surveillance");
    expect(categoryForAction("expense.verified")).toBe("finance");
    expect(categoryForAction("scheduled_job.executed")).toBe("jobs");
  });
});

describe("matchesTimeRange", () => {
  const baseTime = new Date("2026-09-24T12:00:00.000Z").getTime();

  it("always matches when preset is 'all'", () => {
    expect(matchesTimeRange("2026-01-01T00:00:00.000Z", "all", undefined, undefined, baseTime)).toBe(true);
    expect(matchesTimeRange("2026-09-24T12:00:00.000Z", "all", undefined, undefined, baseTime)).toBe(true);
  });

  it("filters correctly for 30m, 1h, 12h, 24h presets", () => {
    const tenMinutesAgo = new Date(baseTime - 10 * 60 * 1000).toISOString();
    const fortyFiveMinutesAgo = new Date(baseTime - 45 * 60 * 1000).toISOString();
    const twoHoursAgo = new Date(baseTime - 2 * 60 * 60 * 1000).toISOString();
    const eighteenHoursAgo = new Date(baseTime - 18 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(baseTime - 2 * 24 * 60 * 60 * 1000).toISOString();

    // 30m
    expect(matchesTimeRange(tenMinutesAgo, "30m", undefined, undefined, baseTime)).toBe(true);
    expect(matchesTimeRange(fortyFiveMinutesAgo, "30m", undefined, undefined, baseTime)).toBe(false);

    // 1h
    expect(matchesTimeRange(fortyFiveMinutesAgo, "1h", undefined, undefined, baseTime)).toBe(true);
    expect(matchesTimeRange(twoHoursAgo, "1h", undefined, undefined, baseTime)).toBe(false);

    // 12h
    expect(matchesTimeRange(twoHoursAgo, "12h", undefined, undefined, baseTime)).toBe(true);
    expect(matchesTimeRange(eighteenHoursAgo, "12h", undefined, undefined, baseTime)).toBe(false);

    // 24h
    expect(matchesTimeRange(eighteenHoursAgo, "24h", undefined, undefined, baseTime)).toBe(true);
    expect(matchesTimeRange(twoDaysAgo, "24h", undefined, undefined, baseTime)).toBe(false);
  });

  it("filters correctly for 3d, 7d, 30d presets", () => {
    const twoDaysAgo = new Date(baseTime - 2 * 24 * 60 * 60 * 1000).toISOString();
    const fiveDaysAgo = new Date(baseTime - 5 * 24 * 60 * 60 * 1000).toISOString();
    const tenDaysAgo = new Date(baseTime - 10 * 24 * 60 * 60 * 1000).toISOString();
    const fortyDaysAgo = new Date(baseTime - 40 * 24 * 60 * 60 * 1000).toISOString();

    // 3d
    expect(matchesTimeRange(twoDaysAgo, "3d", undefined, undefined, baseTime)).toBe(true);
    expect(matchesTimeRange(fiveDaysAgo, "3d", undefined, undefined, baseTime)).toBe(false);

    // 7d
    expect(matchesTimeRange(fiveDaysAgo, "7d", undefined, undefined, baseTime)).toBe(true);
    expect(matchesTimeRange(tenDaysAgo, "7d", undefined, undefined, baseTime)).toBe(false);

    // 30d
    expect(matchesTimeRange(tenDaysAgo, "30d", undefined, undefined, baseTime)).toBe(true);
    expect(matchesTimeRange(fortyDaysAgo, "30d", undefined, undefined, baseTime)).toBe(false);
  });

  it("filters correctly with custom date ranges", () => {
    expect(matchesTimeRange("2026-09-15T10:00:00.000Z", "custom", "2026-09-10", "2026-09-20", baseTime)).toBe(true);
    expect(matchesTimeRange("2026-09-05T10:00:00.000Z", "custom", "2026-09-10", "2026-09-20", baseTime)).toBe(false);
    expect(matchesTimeRange("2026-09-25T10:00:00.000Z", "custom", "2026-09-10", "2026-09-20", baseTime)).toBe(false);

    // Only start date
    expect(matchesTimeRange("2026-09-15T10:00:00.000Z", "custom", "2026-09-10", "", baseTime)).toBe(true);
    expect(matchesTimeRange("2026-09-05T10:00:00.000Z", "custom", "2026-09-10", "", baseTime)).toBe(false);

    // Only end date
    expect(matchesTimeRange("2026-09-15T10:00:00.000Z", "custom", "", "2026-09-20", baseTime)).toBe(true);
    expect(matchesTimeRange("2026-09-25T10:00:00.000Z", "custom", "", "2026-09-20", baseTime)).toBe(false);
  });
});

