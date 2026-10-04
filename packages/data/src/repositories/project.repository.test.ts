import { describe, expect, it } from "vitest";
import {
  toProjectWithNames,
  type ProjectRow,
  type ProjectWithNamesRow,
} from "./project.repository.js";

const BASE_ROW: ProjectRow = {
  id: "11111111-2222-3333-4444-555555555555",
  code: "PRJ-VANI-001",
  name: "Vani Vihar SC/ST Hostel",
  type: "institution",
  description: null,
  organisationId: "aaaaaaaa-0000-4000-8000-000000000001",
  authorityId: "bbbbbbbb-0000-4000-8000-000000000002",
  districtId: "cccccccc-0000-4000-8000-000000000003",
  villageId: null,
  schemeComponentId: null,
  status: "Active",
  approvedById: null,
  approvedAt: null,
  contactName: null,
  contactPhone: null,
  contactEmail: null,
  programmeIds: [],
  createdAt: new Date("2026-01-02T03:04:05.000Z"),
  updatedAt: new Date("2026-01-02T03:04:05.000Z"),
};

const BASE_NAMES = {
  organisationName: "Vani Vihar SC/ST Hostel",
  authorityName: "District Social Welfare Office, Khordha",
  districtName: "Khordha",
  stateName: "Odisha",
  programmeNames: ["Pradhan Mantri Anusuchit Jaati Abhyuday Yojana (PM-AJAY)"],
};

function row(overrides: Partial<ProjectWithNamesRow> = {}): ProjectWithNamesRow {
  return { project: BASE_ROW, ...BASE_NAMES, ...overrides };
}

describe("toProjectWithNames", () => {
  it("exposes every joined related-entity name", () => {
    const project = toProjectWithNames(row());

    expect(project.organisationName).toBe("Vani Vihar SC/ST Hostel");
    expect(project.authorityName).toBe("District Social Welfare Office, Khordha");
    expect(project.districtName).toBe("Khordha");
    expect(project.stateName).toBe("Odisha");
    expect(project.programmeNames).toEqual([
      "Pradhan Mantri Anusuchit Jaati Abhyuday Yojana (PM-AJAY)",
    ]);
  });

  it("keeps null for a LEFT JOIN miss, as with village-type targets", () => {
    const project = toProjectWithNames(
      row({
        project: { ...BASE_ROW, organisationId: null, authorityId: null, type: "village" },
        organisationName: null,
        authorityName: null,
        programmeNames: null,
      }),
    );

    expect(project.organisationName).toBeNull();
    expect(project.authorityName).toBeNull();
    // A null aggregate must become an empty array, never null.
    expect(project.programmeNames).toEqual([]);
  });

  it("still maps the project columns unchanged", () => {
    const project = toProjectWithNames(row());

    expect(project.id).toBe(BASE_ROW.id);
    expect(project.name).toBe(BASE_ROW.name);
    expect(project.status).toBe("Active");
    expect(project.createdAt).toBe("2026-01-02T03:04:05.000Z");
  });
});
