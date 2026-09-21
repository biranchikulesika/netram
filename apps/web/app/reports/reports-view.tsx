"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import type { Report } from "@netram/types";
import { IconSearch, IconChevronRight } from "../components/icons";
import { formatDate, formatDateTime, getDistrictName } from "../../lib/presentation";
import { GenerateReportModal } from "./generate-report-modal";

interface ReportsViewProps {
  initialReports: Report[];
  total: number;
  canGenerate: boolean;
  canFinalize: boolean;
  availableInspections?: Array<{
    id: string;
    projectCode: string;
    projectName: string;
    type: string;
    status: string;
  }>;
}

export function ReportsView({
  initialReports,
  total: initialTotal,
  canGenerate,
  canFinalize: _canFinalize,
  availableInspections = [],
}: ReportsViewProps) {
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [total, setTotal] = useState(initialTotal);
  const [filter, setFilter] = useState<"ALL" | "READY" | "FINALIZED" | "GENERATING">("ALL");
  const [search, setSearch] = useState("");
  const [generateModalOpen, setGenerateModalOpen] = useState(false);

  const readyCount = useMemo(
    () => reports.filter((r) => r.status === "ready").length,
    [reports],
  );

  const finalizedCount = useMemo(
    () => reports.filter((r) => r.status === "finalized").length,
    [reports],
  );

  const generatingCount = useMemo(
    () => reports.filter((r) => r.status === "generating" || r.status === "requested").length,
    [reports],
  );

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (filter === "READY" && r.status !== "ready") return false;
      if (filter === "FINALIZED" && r.status !== "finalized") return false;
      if (filter === "GENERATING" && r.status !== "generating" && r.status !== "requested") return false;

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const code = r.projectCode?.toLowerCase() ?? "";
        const name = r.projectName?.toLowerCase() ?? "";
        const id = r.id.toLowerCase();
        const inspId = r.inspectionId.toLowerCase();
        return code.includes(q) || name.includes(q) || id.includes(q) || inspId.includes(q);
      }

      return true;
    });
  }, [reports, filter, search]);

  const handleReportCreated = (newReport: Report) => {
    setReports((prev) => [newReport, ...prev]);
    setTotal((prev) => prev + 1);
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="registry-toolbar">
        <div className="search-filter-group">
          <div className="search-input-wrap">
            <IconSearch className="search-icon-svg" style={{ width: 16, height: 16 }} />
            <input
              type="search"
              placeholder="Search reports by project code, facility, or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input-with-icon"
              aria-label="Filter reports"
            />
          </div>

          <div className="filter-tabs" role="tablist" aria-label="Report status filters">
            <button
              type="button"
              className={`filter-tab-btn ${filter === "ALL" ? "active" : ""}`}
              onClick={() => setFilter("ALL")}
              role="tab"
              aria-selected={filter === "ALL"}
            >
              <span>All</span>
              <span className="filter-count-badge">{total}</span>
            </button>

            <button
              type="button"
              className={`filter-tab-btn ${filter === "READY" ? "active" : ""}`}
              onClick={() => setFilter("READY")}
              role="tab"
              aria-selected={filter === "READY"}
            >
              <span>Ready</span>
              <span className="filter-count-badge">{readyCount}</span>
            </button>

            <button
              type="button"
              className={`filter-tab-btn ${filter === "FINALIZED" ? "active" : ""}`}
              onClick={() => setFilter("FINALIZED")}
              role="tab"
              aria-selected={filter === "FINALIZED"}
            >
              <span>Finalized</span>
              <span className="filter-count-badge">{finalizedCount}</span>
            </button>

            <button
              type="button"
              className={`filter-tab-btn ${filter === "GENERATING" ? "active" : ""}`}
              onClick={() => setFilter("GENERATING")}
              role="tab"
              aria-selected={filter === "GENERATING"}
            >
              <span>Generating</span>
              <span className="filter-count-badge">{generatingCount}</span>
            </button>
          </div>
        </div>

        {canGenerate && (
          <button
            type="button"
            onClick={() => setGenerateModalOpen(true)}
            style={{
              background: "var(--color-navy-brand, #1e3a8a)",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "0.5rem 1rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.08)",
            }}
          >
            <span>+ Compile Report</span>
          </button>
        )}
      </div>

      {/* Reports Table Card */}
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Inspection Report / Facility</th>
              <th>Format</th>
              <th>Status</th>
              <th>Created</th>
              <th>Finalized</th>
              <th style={{ width: "120px", textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: "center", padding: "3rem 1rem" }}>
                  No statutory inspection reports found.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div>
                      <Link
                        href={`/reports/${r.id}`}
                        style={{ fontWeight: 600, color: "var(--color-navy-brand)", textDecoration: "none", fontSize: "0.9rem" }}
                      >
                        {r.projectName ?? "Statutory Inspection Dossier"}
                      </Link>
                      <div className="muted" style={{ fontSize: "0.78rem", marginTop: "0.15rem" }}>
                        Facility: <strong>{r.projectCode ?? "—"}</strong> ·{" "}
                        {r.districtId ? getDistrictName(r.districtId, r.projectCode ?? undefined) : "State Oversight"} ·{" "}
                        <span style={{ textTransform: "capitalize" }}>{r.inspectionType}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-routine" style={{ fontSize: "0.72rem" }}>
                      {r.format.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`status status-${r.status}`}
                      style={{ textTransform: "capitalize", fontWeight: 600 }}
                    >
                      {r.status === "finalized" ? "✓ Finalized" : r.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="muted" style={{ fontSize: "0.8rem" }}>
                    {formatDate(r.createdAt)}
                  </td>
                  <td className="muted" style={{ fontSize: "0.8rem" }}>
                    {r.finalizedAt ? formatDateTime(r.finalizedAt) : "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link
                      href={`/reports/${r.id}`}
                      className="btn-secondary"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        fontSize: "0.78rem",
                        padding: "0.3rem 0.65rem",
                        textDecoration: "none",
                        fontWeight: 600,
                      }}
                    >
                      <span>Dossier</span>
                      <IconChevronRight style={{ width: 13, height: 13 }} />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="table-footer-info">
          <span>Showing {filtered.length} of {total} reports</span>
        </div>
      </div>

      {/* Generate Report Modal */}
      {generateModalOpen && (
        <GenerateReportModal
          isOpen={generateModalOpen}
          onClose={() => setGenerateModalOpen(false)}
          onSuccess={handleReportCreated}
          availableInspections={availableInspections}
        />
      )}
    </div>
  );
}
