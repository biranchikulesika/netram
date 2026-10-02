import { describe, expect, it } from "vitest";
import type { AIAnomaly, Complaint, CorrectiveAction, Inspection, Project } from "@netram/types";
import {
  buildAttention,
  buildUpcoming,
  isOperationalCategory,
  relativeAge,
  relativeDayLabel,
  summariseState,
  type OverviewData,
} from "./overview-model";

const NOW = Date.parse("2026-10-10T09:00:00.000Z");
const days = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

function overview(over: Partial<OverviewData> = {}): OverviewData {
  return {
    projects: [],
    inspections: [],
    overdueActions: [],
    complaints: [],
    anomalies: [],
    totals: {
      projects: 0,
      activeProjects: 0,
      inspections: 0,
      openComplaints: 0,
    },
    ...over,
  };
}

const project = (over: Partial<Project> = {}) =>
  ({
    id: "p1",
    code: "PRJ-1",
    name: "Kharag Hostel",
    status: "Active",
    createdAt: days(-60),
    updatedAt: days(-60),
    ...over,
  }) as Project;

const inspection = (over: Partial<Inspection> = {}) =>
  ({
    id: "i1",
    projectId: "p1",
    projectName: "Kharag Hostel",
    type: "routine",
    status: "scheduled",
    scheduledStart: days(1),
    assignedUserIds: [],
    createdAt: days(-5),
    updatedAt: days(-5),
    ...over,
  }) as Inspection;

const action = (over: Partial<CorrectiveAction> = {}) =>
  ({
    id: "ca1",
    status: "overdue",
    deadline: days(-4),
    atrFiles: [],
    project: { id: "p1", code: "PRJ-1", name: "Kharag Hostel" },
    createdAt: days(-30),
    updatedAt: days(-4),
    ...over,
  }) as CorrectiveAction;

const complaint = (over: Partial<Complaint> = {}) =>
  ({
    id: "c1",
    projectName: "Kharag Hostel",
    status: "received",
    trackingCode: "CMP-1",
    description: "x",
    files: [],
    receivedAt: days(-2),
    createdAt: days(-2),
    updatedAt: days(-2),
    ...over,
  }) as Complaint;

const anomaly = (over: Partial<AIAnomaly> = {}) =>
  ({
    id: "a1",
    inspectionId: "i1",
    type: "conflict",
    explanation: "Physical altercation detected near the main gate camera.",
    severity: "high",
    confidence: 0.91,
    status: "new",
    createdAt: days(-1),
    ...over,
  }) as AIAnomaly;

describe("needs attention", () => {
  it("returns nothing when the estate is clean", () => {
    const items = buildAttention(
      overview({
        projects: [project()],
        inspections: [inspection({ scheduledStart: days(2) })],
        complaints: [complaint({ status: "resolved" })],
        anomalies: [anomaly({ severity: "low" })],
      }),
      NOW,
    );
    expect(items).toEqual([]);
  });

  it("surfaces an unreviewed critical alert above everything else", () => {
    const items = buildAttention(
      overview({
        anomalies: [anomaly({ severity: "critical" })],
        overdueActions: [action()],
      }),
      NOW,
    );
    expect(items[0]?.severity).toBe("critical");
    // The written explanation is shown, not the bare "conflict" type label.
    expect(items[0]?.reason).toBe("Physical altercation detected near the main gate camera.");
    // Age, not a model confidence score: the badge already states the band.
    expect(items[0]?.meta).toBe("Detected 1 day ago");
    expect(items[0]?.meta).not.toContain("confidence");
  });

  it("falls back to the type when the alert carries no explanation", () => {
    const items = buildAttention(overview({ anomalies: [anomaly({ explanation: "" })] }), NOW);
    expect(items[0]?.reason).toBe("Conflict detected");
  });

  it("keeps a long explanation to one scannable line", () => {
    const items = buildAttention(
      overview({ anomalies: [anomaly({ explanation: "x".repeat(400) })] }),
      NOW,
    );
    expect(items[0]?.reason).toHaveLength(160);
    expect(items[0]?.reason.endsWith("…")).toBe(true);
  });

  it("ignores alerts that are low severity or already triaged", () => {
    const items = buildAttention(
      overview({
        anomalies: [
          anomaly({ id: "a1", severity: "low" }),
          anomaly({ id: "a2", severity: "medium" }),
          anomaly({ id: "a3", severity: "critical", status: "dismissed" }),
          anomaly({ id: "a4", severity: "high", status: "investigated" }),
        ],
      }),
      NOW,
    );
    expect(items).toEqual([]);
  });

  it("reports how long a corrective action has been overdue", () => {
    const item = buildAttention(overview({ overdueActions: [action()] }), NOW)[0];
    expect(item?.reason).toBe("Corrective action past its deadline");
    expect(item?.meta).toBe("Due 4 days ago");
  });

  it("escalates a complaint only once it is actually escalated", () => {
    const items = buildAttention(
      overview({ complaints: [complaint({ status: "escalated" })] }),
      NOW,
    );
    expect(items[0]?.severity).toBe("high");
    expect(items[0]?.reason).toBe("Complaint escalated to the state authority");
  });

  it("treats a resolved or closed complaint as settled", () => {
    const items = buildAttention(
      overview({
        complaints: [
          complaint({ id: "c1", status: "resolved" }),
          complaint({ id: "c2", status: "closed" }),
        ],
      }),
      NOW,
    );
    expect(items).toEqual([]);
  });

  it("flags a scheduled inspection only after its start date has passed", () => {
    const late = buildAttention(
      overview({ inspections: [inspection({ scheduledStart: days(-3) })] }),
      NOW,
    );
    expect(late[0]?.reason).toBe("Routine not started");
    expect(late[0]?.meta).toBe("Scheduled 3 days ago");

    const future = buildAttention(overview({ inspections: [inspection()] }), NOW);
    expect(future).toEqual([]);
  });

  it("shows inspection staleness on a suspended facility", () => {
    const items = buildAttention(
      overview({
        projects: [project({ status: "Suspended" })],
        inspections: [inspection({ status: "closed", submittedAt: days(-9) })],
      }),
      NOW,
    );
    expect(items[0]?.reason).toBe("Facility suspended");
    expect(items[0]?.meta).toBe("Last inspection 9 days ago");
  });

  it("says so plainly when a facility has no completed inspection", () => {
    const items = buildAttention(
      overview({ projects: [project({ status: "Pending Verification" })] }),
      NOW,
    );
    expect(items[0]?.meta).toBe("No completed inspection on record");
  });

  it("caps the list so the section stays scannable", () => {
    const items = buildAttention(
      overview({
        projects: Array.from({ length: 20 }, (_, i) =>
          project({ id: `p${i}`, status: "Suspended" }),
        ),
      }),
      NOW,
    );
    expect(items).toHaveLength(8);
  });
});

describe("happening next", () => {
  it("lists only pending work scheduled in the future, soonest first", () => {
    const items = buildUpcoming(
      [
        inspection({ id: "i1", scheduledStart: days(5) }),
        inspection({ id: "i2", scheduledStart: days(1) }),
        inspection({ id: "i3", scheduledStart: days(-1) }),
        inspection({ id: "i4", scheduledStart: days(2), status: "closed" }),
      ],
      NOW,
    );
    expect(items.map((i) => i.id)).toEqual(["i2", "i1"]);
    expect(items[0]?.when).toBe("Tomorrow");
  });

  it("phrases near dates in words and distant ones as dates", () => {
    expect(relativeDayLabel(NOW, NOW)).toBe("Today");
    expect(relativeDayLabel(NOW + 86_400_000, NOW)).toBe("Tomorrow");
    expect(relativeDayLabel(NOW + 3 * 86_400_000, NOW)).toBe("In 3 days");
    expect(relativeDayLabel(NOW + 40 * 86_400_000, NOW)).toMatch(/\d+ \w{3}/);
  });
});

const ALL_READABLE = {
  facilities: true,
  active: true,
  inspections: true,
  overdueActions: true,
  openComplaints: true,
  attention: true,
} as const;

describe("current state", () => {
  it("shows the API totals verbatim rather than counting a fetched page", () => {
    const metrics = summariseState(
      overview({
        projects: [project()],
        totals: {
          projects: 128,
          activeProjects: 96,
          inspections: 12,
          openComplaints: 3,
        },
      }),
      2,
      ALL_READABLE,
    );
    const byLabel = Object.fromEntries(metrics.map((m) => [m.label, m.value]));

    // Labels must state what is counted: a bare "Active" says nothing about
    // what is active, and "Requires attention" omits the noun entirely.
    expect(byLabel).toEqual({
      "Facilities monitored": 128,
      "Of those, active": 96,
      "Inspections on record": 12,
      "Unresolved complaints": 3,
      "Items needing action": 2,
    });
  });

  it("only highlights the exception count", () => {
    const metrics = summariseState(overview(), 0, ALL_READABLE);
    expect(metrics.filter((m) => m.highlight)).toHaveLength(0);
    expect(summariseState(overview(), 3, ALL_READABLE).filter((m) => m.highlight)).toHaveLength(1);
  });

  it("marks a refused list as unreadable instead of reporting zero", () => {
    // A role that cannot read complaints must not be shown "0 unresolved
    // complaints" - that reads as good news and is not true.
    const metrics = summariseState(
      overview({ totals: { ...overview().totals, openComplaints: 0 } }),
      0,
      {
        ...ALL_READABLE,
        openComplaints: false,
      },
    );
    const complaints = metrics.find((m) => m.id === "openComplaints");
    expect(complaints?.readable).toBe(false);
    expect(metrics.find((m) => m.id === "facilities")?.readable).toBe(true);
  });

  it("treats attention as unknown when any contributing list was refused", () => {
    const partial = summariseState(overview(), 0, { ...ALL_READABLE, inspections: false });
    expect(partial.find((m) => m.id === "attention")?.readable).toBe(false);
  });
});

describe("activity filtering", () => {
  it("keeps operational work and drops sign-ins and job churn", () => {
    expect(isOperationalCategory("inspections")).toBe(true);
    expect(isOperationalCategory("grievances")).toBe(true);
    expect(isOperationalCategory("security")).toBe(false);
    expect(isOperationalCategory("jobs")).toBe(false);
  });
});

describe("date phrasing", () => {
  it("describes age in hours and days, and refuses future times", () => {
    expect(relativeAge(new Date(NOW - 30_000).toISOString(), NOW)).toBe("just now");
    expect(relativeAge(new Date(NOW - 3_600_000).toISOString(), NOW)).toBe("1 hour ago");
    expect(relativeAge(new Date(NOW - 5 * 3_600_000).toISOString(), NOW)).toBe("5 hours ago");
    expect(relativeAge(days(-1), NOW)).toBe("1 day ago");
    expect(relativeAge(days(-3), NOW)).toBe("3 days ago");
    expect(relativeAge(days(1), NOW)).toBeNull();
    expect(relativeAge(null, NOW)).toBeNull();
  });
});
