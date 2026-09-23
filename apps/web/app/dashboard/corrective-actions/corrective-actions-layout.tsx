"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { CorrectiveAction, FindingAwaitingOrder, OrganisationView } from "@netram/types";
import { formatDate } from "../../../lib/presentation";
import { useMediaQuery, distributeIntoColumns } from "../../../lib/card-layout";
import { CorrectiveActionCard, getStatusBadge, getSeverityStyle } from "./corrective-action-card";
import { OrderCorrectiveActionButton } from "../../components/order-corrective-action-button";
import {
  IconSearch,
  IconList,
  IconGrid,
  IconMapPin,
  IconGavel,
} from "../../components/icons";

const CorrectiveActionsMap = dynamic(() => import("./corrective-actions-map"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: "calc(100vh - 205px)",
        minHeight: "440px",
        background: "var(--bg-subtle)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
        fontSize: "0.85rem",
        fontWeight: 600,
      }}
    >
      Loading map…
    </div>
  ),
});

export interface CorrectiveActionsLayoutProps {
  initialActions: CorrectiveAction[];
  totalActions: number;
  awaitingOrders: FindingAwaitingOrder[];
  canOrder: boolean;
  organisations: OrganisationView[];
}

type StatusFilter = "ALL" | "PENDING" | "IN_REVIEW" | "OVERDUE" | "ACCEPTED";
type ViewMode = "table" | "cards" | "map";

function matchesFilter(a: CorrectiveAction, filter: StatusFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "PENDING") return a.status === "pending" || a.status === "rejected";
  if (filter === "IN_REVIEW") return a.status === "submitted" || a.status === "under_review";
  if (filter === "OVERDUE") return a.status === "overdue" || a.status === "escalated";
  return a.status === "accepted";
}

export function CorrectiveActionsLayout({
  initialActions,
  totalActions: _totalActions,
  awaitingOrders,
  canOrder,
  organisations,
}: CorrectiveActionsLayoutProps) {
  const [actionsList] = useState<CorrectiveAction[]>(initialActions);
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // Metrics
  const metrics = useMemo(() => {
    const total = actionsList.length;
    const pending = actionsList.filter((a) => a.status === "pending" || a.status === "rejected").length;
    const inReview = actionsList.filter((a) => a.status === "submitted" || a.status === "under_review").length;
    const overdue = actionsList.filter((a) => a.status === "overdue" || a.status === "escalated").length;
    const accepted = actionsList.filter((a) => a.status === "accepted").length;
    return { total, pending, inReview, overdue, accepted };
  }, [actionsList]);

  // Filtered
  const filtered = useMemo(() => {
    return actionsList.filter((a) => {
      if (!matchesFilter(a, filter)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = a.id.toLowerCase().includes(q);
        const matchesFinding = a.findingId.toLowerCase().includes(q);
        const matchesInspection = a.inspectionId.toLowerCase().includes(q);
        const matchesStatus = a.status.toLowerCase().includes(q);
        const matchesProject =
          (a.project?.name.toLowerCase().includes(q) ?? false) ||
          (a.project?.code.toLowerCase().includes(q) ?? false);
        return matchesId || matchesFinding || matchesInspection || matchesStatus || matchesProject;
      }

      return true;
    });
  }, [actionsList, filter, searchQuery]);

  const filterTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "ALL", label: "All", count: metrics.total },
    { key: "PENDING", label: "Pending Compliance", count: metrics.pending },
    { key: "IN_REVIEW", label: "In Review", count: metrics.inReview },
    { key: "OVERDUE", label: "Overdue / Escalated", count: metrics.overdue },
    { key: "ACCEPTED", label: "Accepted / Closed", count: metrics.accepted },
  ];

  const emptyState =
    searchQuery || filter !== "ALL"
      ? "No corrective actions match the selected filter criteria."
      : "No corrective actions recorded.";

  const isXl = useMediaQuery("(min-width: 1401px)");
  const isLg = useMediaQuery("(min-width: 1101px) and (max-width: 1400px)");
  const isMd = useMediaQuery("(min-width: 641px) and (max-width: 1100px)");
  const columnCount = isXl ? 4 : isLg ? 3 : isMd ? 2 : 1;
  const cardColumns = useMemo(
    () => distributeIntoColumns(filtered, columnCount),
    [filtered, columnCount],
  );

  return (
    <div>
      {/* Pending remediation orders (authority queue, §32) */}
      {canOrder && awaitingOrders.length > 0 && (
        <div className="table-card" style={{ marginBottom: "1.25rem" }}>
          <div
            style={{
              padding: "1rem 1.25rem",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                background: "#fef3c7",
                color: "#b45309",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IconGavel style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
                Pending Remediation Orders
              </h3>
              <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.8rem" }}>
                {awaitingOrders.length} confirmed finding{awaitingOrders.length === 1 ? "" : "s"} in your
                jurisdiction awaiting a corrective action order.
              </p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Facility</th>
                <th>Severity</th>
                <th>Finding</th>
                <th style={{ width: "220px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {awaitingOrders.map((f) => {
                const severityMeta = getSeverityStyle(f.severity);
                return (
                  <tr key={f.id}>
                    <td>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--color-navy-brand)" }}>
                        {f.project.name}
                      </div>
                      <div className="muted" style={{ fontSize: "0.72rem" }}>
                        {f.project.code}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: severityMeta.color }}>
                        {severityMeta.label}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: "0.8rem" }}>{f.description}</div>
                      {f.remediation && (
                        <div className="muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>
                          <span style={{ fontWeight: 600, color: "#334155" }}>Remediation:</span>{" "}
                          {f.remediation}
                        </div>
                      )}
                      <div className="muted" style={{ fontSize: "0.72rem", marginTop: "0.25rem" }}>
                        Inspection: {f.inspectionId.slice(0, 8)} ·
                        {formatDate(f.createdAt)}
                      </div>
                    </td>
                    <td>
                      <OrderCorrectiveActionButton
                        finding={{
                          id: f.id,
                          severity: f.severity,
                          description: f.description,
                          remediation: f.remediation,
                        }}
                        inspectionId={f.inspectionId}
                        project={{
                          name: f.project.name,
                          code: f.project.code,
                          organisationId: f.project.organisationId,
                        }}
                        organisations={organisations}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Toolbar: Search, Filters & View Toggle (projects pattern) */}
      <div
        className="registry-toolbar"
        style={{ marginBottom: viewMode === "map" ? "0.6rem" : "1.25rem" }}
      >
        <div className="search-filter-group">
          <div className="search-input-wrap">
            <IconSearch className="search-icon-svg" style={{ width: 16, height: 16 }} />
            <input
              type="search"
              placeholder="Search by action ID, finding ID, ATR code, facility…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input-with-icon"
              aria-label="Filter corrective actions"
            />
          </div>

          <div className="filter-tabs" role="tablist" aria-label="Corrective action status filters">
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

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div className="view-mode-toggle" aria-label="Toggle view mode">
            <button
              type="button"
              className={`view-btn ${viewMode === "table" ? "active" : ""}`}
              onClick={() => setViewMode("table")}
              title="Table View"
            >
              <IconList style={{ width: 14, height: 14 }} />
              <span>Table</span>
            </button>
            <button
              type="button"
              className={`view-btn ${viewMode === "cards" ? "active" : ""}`}
              onClick={() => setViewMode("cards")}
              title="Cards View"
            >
              <IconGrid style={{ width: 14, height: 14 }} />
              <span>Cards</span>
            </button>
            <button
              type="button"
              className={`view-btn ${viewMode === "map" ? "active" : ""}`}
              onClick={() => setViewMode("map")}
              title="Geographic Map View"
            >
              <IconMapPin style={{ width: 14, height: 14 }} />
              <span>Map</span>
            </button>
          </div>
        </div>
      </div>

      {/* View: Table */}
      {viewMode === "table" && (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Finding Reference</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Statutory Deadline</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted" style={{ textAlign: "center", padding: "2.5rem" }}>
                    {emptyState}
                  </td>
                </tr>
              ) : (
                filtered.map((ca) => {
                  const statusMeta = getStatusBadge(ca.status);
                  const findingMeta = getSeverityStyle(ca.finding?.severity ?? "low");
                  const findingLabel =
                    ca.finding?.categoryName ??
                    (ca.finding ? ca.finding.description : `Finding ${ca.findingId.slice(0, 8)}`);

                  const isOverdue =
                    ca.deadline &&
                    ca.status !== "accepted" &&
                    new Date(ca.deadline) < new Date();

                  return (
                    <tr key={ca.id}>
                      <td>
                        <div>
                          <Link
                            href={`/dashboard/corrective-actions/${ca.id}`}
                            style={{
                              fontSize: "0.82rem",
                              fontWeight: 600,
                              color: "var(--color-navy-brand)",
                              textDecoration: "none",
                            }}
                            title={ca.finding?.description ?? undefined}
                          >
                            {findingLabel}
                          </Link>
                          <div className="muted" style={{ fontSize: "0.72rem" }}>
                            {ca.project ? `${ca.project.name} (${ca.project.code})` : `Inspection: ${ca.inspectionId.slice(0, 8)}...`}
                          </div>
                        </div>
                      </td>

                      <td>
                        {ca.finding ? (
                          <span
                            title={ca.finding.description}
                            style={{ fontSize: "0.72rem", fontWeight: 700, color: findingMeta.color }}
                          >
                            {findingMeta.label}
                          </span>
                        ) : (
                          <span className="muted" style={{ fontSize: "0.8rem" }}>—</span>
                        )}
                      </td>

                      <td>
                        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: statusMeta.color }}>
                          {statusMeta.label}
                        </span>
                      </td>

                      <td className="muted" style={{ fontSize: "0.8rem" }}>
                        {ca.deadline ? (
                          <span style={{ color: isOverdue ? "#dc2626" : "inherit", fontWeight: isOverdue ? 700 : 400 }}>
                            {formatDate(ca.deadline)}
                            {isOverdue && " (Overdue)"}
                          </span>
                        ) : (
                          "No deadline set"
                        )}
                      </td>

                      <td className="muted" style={{ fontSize: "0.8rem" }}>
                        {formatDate(ca.createdAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* View: Cards */}
      {viewMode === "cards" && (
        <div>
          {filtered.length === 0 ? (
            <div className="empty-box" style={{ padding: "3rem 1rem", marginBottom: "2rem" }}>
              <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "0.25rem", color: "var(--text-primary)" }}>
                No corrective actions found
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-subtle)" }}>{emptyState}</div>
            </div>
          ) : (
            <div className="facility-cards-grid">
              {cardColumns.map((column, colIdx) => (
                <div className="facility-cards-column" key={colIdx}>
                  {column.map((ca) => (
                    <CorrectiveActionCard ca={ca} key={ca.id} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* View: Map */}
      {viewMode === "map" && (
        <div className="map-view-wrapper" style={{ height: "calc(100vh - 205px)", minHeight: "440px" }}>
          <CorrectiveActionsMap actions={filtered} />
        </div>
      )}
    </div>
  );
}
