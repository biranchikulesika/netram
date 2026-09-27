"use client";

import React, { useState } from "react";
import { IconChevronRight } from "./icons";

/**
 * Lifecycle bucket for the funds status filter. Buckets must be disjoint and,
 * taken together, cover every status the API can return — otherwise a
 * fully-selected filter silently hides rows.
 */
export interface StatusBucket {
  value: string;
  label: string;
  statuses: string[];
}

/**
 * Expenditure buckets — mirrors the expense lifecycle in
 * `packages/types/src/fund.ts` (draft → submitted → under_review → verified,
 * plus the rejected/voided terminal states).
 */
export const EXPENSE_STATUS_FILTERS: StatusBucket[] = [
  { value: "ALL", label: "All", statuses: [] },
  { value: "pending", label: "Pending Verification", statuses: ["submitted", "under_review"] },
  { value: "verified", label: "Verified", statuses: ["verified"] },
  { value: "rejected", label: "Rejected", statuses: ["rejected"] },
  { value: "voided", label: "Voided", statuses: ["voided"] },
  { value: "draft", label: "Draft", statuses: ["draft"] },
];

/** Allocation buckets — `FundAllocationStatus` is active | revised | cancelled. */
export const ALLOCATION_STATUS_FILTERS: StatusBucket[] = [
  { value: "ALL", label: "All", statuses: [] },
  { value: "active", label: "Active", statuses: ["active"] },
  { value: "revised", label: "Revised", statuses: ["revised"] },
  { value: "cancelled", label: "Cancelled", statuses: ["cancelled"] },
];

/** The buckets a user can tick; the synthetic "ALL" row is select-only. */
function selectable(filters: StatusBucket[]): string[] {
  return filters.filter((f) => f.value !== "ALL").map((f) => f.value);
}

/** True when `status` falls in any selected bucket. Empty selection = no filter. */
export function matchesStatusFilter(
  status: string,
  selected: string[],
  filters: StatusBucket[],
): boolean {
  if (selected.length === 0) return true;
  return filters.some(
    (bucket) =>
      bucket.value !== "ALL" && selected.includes(bucket.value) && bucket.statuses.includes(status),
  );
}

/**
 * Status filter pop-up, shared by the funds dashboard and the facility funds
 * tab so both render the identical screen.
 *
 * Multi-select: "All" selects every bucket; unticking one leaves "All" unticked
 * while keeping the rest; re-ticking the final remaining bucket re-checks "All".
 * An empty selection would silently mean "show everything", so the last ticked
 * bucket cannot be removed and "All" is select-only.
 */
export function StatusFilter({
  filters,
  selected,
  onChange,
  title,
  style,
}: {
  filters: StatusBucket[];
  selected: string[];
  onChange: (next: string[]) => void;
  title: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const options = selectable(filters);
  const allSelected = selected.length === options.length;

  const toggle = (value: string) => {
    if (value === "ALL") {
      onChange([...options]);
      return;
    }
    onChange(
      selected.includes(value)
        ? selected.length > 1
          ? selected.filter((v) => v !== value)
          : selected
        : [...selected, value],
    );
  };

  return (
    <div style={{ position: "relative", ...style }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="filter-tab-btn active"
        aria-haspopup="menu"
        aria-expanded={open}
        title={title}
        style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}
      >
        <span>
          {allSelected
            ? "All"
            : selected.length === 1
              ? (filters.find((o) => o.value === selected[0])?.label ?? "All")
              : `${selected.length} statuses`}
        </span>
        <IconChevronRight
          width={12}
          height={12}
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }}
        />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 0.5rem)",
              zIndex: 50,
              minWidth: "220px",
              background: "#ffffff",
              border: "1px solid var(--color-border-subtle)",
              borderRadius: "10px",
              boxShadow: "0 12px 32px rgba(15, 23, 42, 0.18)",
              padding: "0.4rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.2rem",
            }}
          >
            {filters.map((opt) => {
              const checked = opt.value === "ALL" ? allSelected : selected.includes(opt.value);
              const isLastRemaining = opt.value !== "ALL" && selected.length === 1 && checked;
              return (
                <label
                  key={opt.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.55rem",
                    padding: opt.value === "ALL" ? "0.45rem 0.6rem" : "0.4rem 0.6rem 0.4rem 1.9rem",
                    marginLeft: opt.value === "ALL" ? 0 : "0.5rem",
                    marginBottom: opt.value === "ALL" ? "0.35rem" : 0,
                    borderLeft: opt.value === "ALL" ? "none" : "1px solid var(--color-border-subtle)",
                    borderRadius: "7px",
                    cursor: isLastRemaining ? "not-allowed" : "pointer",
                    opacity: checked ? 1 : 0.75,
                    fontSize: "0.85rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isLastRemaining}
                    onChange={() => toggle(opt.value)}
                    style={{
                      width: 15,
                      height: 15,
                      cursor: isLastRemaining ? "not-allowed" : "pointer",
                      accentColor: "#4338ca",
                    }}
                  />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
