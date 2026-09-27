import { describe, expect, it } from "vitest";
import type { ExpenseStatus, FundAllocationStatus } from "@netram/types";
import {
  ALLOCATION_STATUS_FILTERS,
  EXPENSE_STATUS_FILTERS,
  matchesStatusFilter,
} from "./fund-status-filter";

const ALL_EXPENSE_BUCKETS = EXPENSE_STATUS_FILTERS.filter((f) => f.value !== "ALL").map(
  (f) => f.value,
);
const ALL_ALLOCATION_BUCKETS = ALLOCATION_STATUS_FILTERS.filter((f) => f.value !== "ALL").map(
  (f) => f.value,
);

/** Mirrors the unions in packages/types/src/fund.ts — a status added there but
 *  not to a bucket must fail here rather than silently disappear from the list. */
const EXPENSE_STATUSES: ExpenseStatus[] = [
  "draft",
  "submitted",
  "under_review",
  "verified",
  "rejected",
  "voided",
];
const ALLOCATION_STATUSES: FundAllocationStatus[] = ["active", "revised", "cancelled"];

describe("matchesStatusFilter", () => {
  it("shows every status when all buckets are selected", () => {
    for (const status of EXPENSE_STATUSES) {
      expect(
        matchesStatusFilter(status, ALL_EXPENSE_BUCKETS, EXPENSE_STATUS_FILTERS),
        `expense ${status}`,
      ).toBe(true);
    }
    for (const status of ALLOCATION_STATUSES) {
      expect(
        matchesStatusFilter(status, ALL_ALLOCATION_BUCKETS, ALLOCATION_STATUS_FILTERS),
        `allocation ${status}`,
      ).toBe(true);
    }
  });

  it("keeps expenditure buckets disjoint so no expense is counted twice", () => {
    for (const status of EXPENSE_STATUSES) {
      const hits = ALL_EXPENSE_BUCKETS.filter((value) =>
        matchesStatusFilter(status, [value], EXPENSE_STATUS_FILTERS),
      );
      expect(hits.length, `expense ${status} matched ${hits.join(",")}`).toBeLessThanOrEqual(1);
    }
  });

  it("treats an empty selection as no filter", () => {
    expect(matchesStatusFilter("verified", [], EXPENSE_STATUS_FILTERS)).toBe(true);
  });

  it("matches only the ticked bucket", () => {
    expect(matchesStatusFilter("verified", ["verified"], EXPENSE_STATUS_FILTERS)).toBe(true);
    expect(matchesStatusFilter("rejected", ["verified"], EXPENSE_STATUS_FILTERS)).toBe(false);
  });

  it("groups submitted and under_review under pending verification", () => {
    expect(matchesStatusFilter("submitted", ["pending"], EXPENSE_STATUS_FILTERS)).toBe(true);
    expect(matchesStatusFilter("under_review", ["pending"], EXPENSE_STATUS_FILTERS)).toBe(true);
  });
});
