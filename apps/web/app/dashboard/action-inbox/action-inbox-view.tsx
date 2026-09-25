"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ActionInboxItem, ActionInboxSection } from "@netram/types";
import { formatDateTime } from "../../../lib/presentation";
import { useMediaQuery, distributeIntoColumns } from "../../../lib/card-layout";
import { ActionInboxCard, type InboxAction } from "./action-inbox-card";
import { IconSearch } from "../../components/icons";

/* ---------- Local inbox icon (not in the shared icon set) ---------- */

function IconInbox({ width = 16, height = 16 }: { width?: number; height?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={width} height={height} aria-hidden="true">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

/* ---------- Filters ---------- */

type ActionFilter = "ALL" | "APPROVALS" | "REVIEWS" | "FINANCIAL";

/** Which inbox kinds belong to each filter tab. */
const FILTER_KINDS: Record<Exclude<ActionFilter, "ALL">, Set<ActionInboxSection["kind"]>> = {
  // Approvals: binary accept/reject decisions.
  APPROVALS: new Set<ActionInboxSection["kind"]>([
    "project_verification",
    "attendance_correction_approval",
  ]),
  // Reviews: judgement calls worked from the full dossier.
  REVIEWS: new Set<ActionInboxSection["kind"]>([
    "finding_review",
    "corrective_action_review",
    "complaint_review",
    "ai_anomaly_review",
    "attendance_anomaly_review",
    "inspection_flag_review",
  ]),
  // Financial verifications (amounts, vouchers, documents).
  FINANCIAL: new Set<ActionInboxSection["kind"]>([
    "expense_verification",
    "financial_document_verification",
  ]),
};

function matchesFilter(item: ActionInboxItem, filter: ActionFilter): boolean {
  if (filter === "ALL") return true;
  return FILTER_KINDS[filter].has(item.kind);
}

function matchesSearch(item: ActionInboxItem, q: string): boolean {
  const haystack = [
    item.title,
    item.summary,
    item.project.name,
    item.project.code,
    item.severity,
    item.actor?.name,
    item.link.label,
  ]
    .filter((v): v is string => typeof v === "string")
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

/* ---------- Row state ---------- */

interface RowState {
  busy: boolean;
  error: string | null;
  done: boolean;
}

const INITIAL_ROW_STATE: RowState = { busy: false, error: null, done: false };

/* ---------- Main view ---------- */

export function ActionInboxView({
  sections,
  generatedAt,
}: {
  sections: ActionInboxSection[];
  generatedAt: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<ActionFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [rowState, setRowState] = useState<Record<string, RowState>>({});

  /** Flat item list across all sections for card rendering. */
  const allItems = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  const metrics = useMemo(() => {
    const count = (f: ActionFilter) => allItems.filter((item) => matchesFilter(item, f)).length;
    return { all: allItems.length, approvals: count("APPROVALS"), reviews: count("REVIEWS"), financial: count("FINANCIAL") };
  }, [allItems]);

  const filtered = useMemo(
    () =>
      allItems.filter((item) => {
        if (!matchesFilter(item, filter)) return false;
        if (searchQuery.trim()) return matchesSearch(item, searchQuery.toLowerCase());
        return true;
      }),
    [allItems, filter, searchQuery],
  );

  const filterTabs: { key: ActionFilter; label: string; count: number }[] = [
    { key: "ALL", label: "All", count: metrics.all },
    { key: "APPROVALS", label: "Approvals", count: metrics.approvals },
    { key: "REVIEWS", label: "Reviews", count: metrics.reviews },
    { key: "FINANCIAL", label: "Financial", count: metrics.financial },
  ];

  function mark(itemId: string, patch: Partial<RowState>) {
    setRowState((s) => ({
      ...s,
      [itemId]: { ...INITIAL_ROW_STATE, ...s[itemId], ...patch },
    }));
  }

  /** Executes a card CTA through the workflow's own canonical endpoint. */
  async function handleAction(item: ActionInboxItem, action: InboxAction) {
    mark(item.id, { busy: true, error: null, done: false });
    try {
      const res = await fetch(action.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.body),
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: { code?: string; message?: string };
      } | null;
      if (!res.ok || payload?.error) {
        mark(item.id, {
          busy: false,
          error: payload?.error?.message ?? `Request failed (${res.status})`,
        });
        return;
      }
      // Completed: the workflow moved past its decision point, so the item
      // leaves the inbox when the server data refreshes.
      mark(item.id, { busy: false, done: true });
      router.refresh();
    } catch (err) {
      mark(item.id, { busy: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const isXl = useMediaQuery("(min-width: 1401px)");
  const isLg = useMediaQuery("(min-width: 1101px) and (max-width: 1400px)");
  const isMd = useMediaQuery("(min-width: 641px) and (max-width: 1100px)");
  // Column breakpoints mirror the complaints card view (4/3/2/1).
  const columnCount = isXl ? 4 : isLg ? 3 : isMd ? 2 : 1;
  const cardColumns = useMemo(
    () => distributeIntoColumns(filtered, columnCount),
    [filtered, columnCount],
  );

  const emptyState =
    searchQuery || filter !== "ALL"
      ? "No items match the selected filter criteria."
      : "Nothing is awaiting your decision right now.";

  /* ---------- Empty inbox (server-confirmed empty) ---------- */
  if (allItems.length === 0 && !searchQuery && filter === "ALL") {
    return (
      <div style={{ padding: "2rem 1.5rem", maxWidth: 720, margin: "3rem auto", textAlign: "center" }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "#dcfce7",
            color: "#15803d",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1rem auto",
          }}
        >
          <IconInbox width={24} height={24} />
        </div>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>Action Inbox</h1>
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          All caught up — nothing is awaiting your decision.
        </p>
        <p className="muted" style={{ fontSize: "0.75rem", marginTop: "2rem" }}>
          Checked {formatDateTime(generatedAt)} ·{" "}
          <button
            type="button"
            onClick={() => router.refresh()}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              textDecoration: "underline",
              cursor: "pointer",
              padding: 0,
              fontSize: "inherit",
            }}
          >
            recheck
          </button>
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar: Search + Filters (complaints/projects pattern) */}
      <div className="registry-toolbar" style={{ marginBottom: "1.25rem" }}>
        <div className="search-filter-group">
          <div className="search-input-wrap">
            <IconSearch className="search-icon-svg" style={{ width: 16, height: 16 }} />
            <input
              type="search"
              placeholder="Search by facility, keyword, submitter…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input-with-icon"
              aria-label="Filter action items"
            />
          </div>

          <div className="filter-tabs" role="tablist" aria-label="Action type filters">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`filter-tab-btn ${filter === tab.key ? "active" : ""}`}
                onClick={() => setFilter(tab.key)}
                role="tab"
                aria-selected={filter === tab.key}
              >
                <span>{tab.label}</span>
                {filter === tab.key && <span className="filter-count-badge">{tab.count}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="empty-box" style={{ padding: "3rem 1rem", marginBottom: "2rem" }}>
          <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "0.25rem", color: "var(--text-primary)" }}>
            No items found
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-subtle)" }}>{emptyState}</div>
        </div>
      ) : (
        <div className="facility-cards-grid">
          {cardColumns.map((column, colIdx) => (
            <div className="facility-cards-column" key={colIdx}>
              {column.map((item) => (
                <ActionInboxCard
                  item={item}
                  key={item.id}
                  state={rowState[item.id] ?? INITIAL_ROW_STATE}
                  onAction={handleAction}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
