import { describe, expect, it } from "vitest";
import {
  currentAndNextFiscalYears,
  expenseAmountMatches,
  getWorkflowEstablishments,
  type ProjectOption,
} from "./funds-dashboard-client";

function establishment(partial: Partial<ProjectOption>): ProjectOption {
  return {
    id: "project-1",
    name: "Establishment One",
    code: "EST-1",
    districtId: "district-1",
    organisationId: "organisation-1",
    status: "Active",
    approvedById: "approver-1",
    stateName: "State One",
    districtName: "District One",
    organisationName: "Organisation One",
    ...partial,
  };
}

describe("currentAndNextFiscalYears", () => {
  it("switches the current fiscal year on 1 April", () => {
    expect(currentAndNextFiscalYears(new Date(2026, 2, 31))).toEqual(["2025-2026", "2026-2027"]);
    expect(currentAndNextFiscalYears(new Date(2026, 3, 1))).toEqual(["2026-2027", "2027-2028"]);
  });
});

describe("expenseAmountMatches", () => {
  it("requires the entered amount to match the expenditure amount", () => {
    expect(expenseAmountMatches("75000.00", "75000.00")).toBe(true);
    expect(expenseAmountMatches("75,000.00", "75000.00")).toBe(true);
    expect(expenseAmountMatches("75000", "75000.00")).toBe(false);
  });
});

describe("getWorkflowEstablishments", () => {
  it("keeps only active, approved establishments and sorts their hierarchy", () => {
    const establishments = getWorkflowEstablishments([
      establishment({ id: "odisha", name: "Z Facility", stateName: "Odisha" }),
      establishment({ id: "odisha", name: "Duplicate Z Facility", stateName: "Odisha" }),
      establishment({
        id: "pending",
        name: "Pending Facility",
        status: "Pending Verification",
      }),
      establishment({ id: "unapproved", name: "Unapproved Facility", approvedById: null }),
      establishment({ id: "unassigned", name: "Unassigned Facility", districtId: null }),
      establishment({ id: "andhra", name: "A Facility", stateName: "Andhra Pradesh" }),
    ]);

    expect(establishments.map(({ id }) => id)).toEqual(["andhra", "odisha"]);
  });
});
