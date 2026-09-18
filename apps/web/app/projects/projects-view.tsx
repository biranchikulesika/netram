"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import type { Project } from "@netram/types";
import { StatusBadge } from "./[id]/status-badge";
import {
  IconBuilding,
  IconSearch,
  IconPlus,
  IconGrid,
  IconList,
  IconMapPin,
  IconChevronRight,
  IconShieldCheck,
} from "../components/icons";
import { getDistrictName, getOrganisationName } from "../../lib/presentation";
import { ProjectsMapView } from "./projects-map-view";

interface ProjectsViewProps {
  initialProjects: Project[];
  totalProjects: number;
  serverPage?: number;
  serverPageSize?: number;
  initialStatus?: string;
  apiUrl: string;
}

function getPaginationRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, "...", total];
  }
  if (current >= total - 3) {
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, "...", current - 1, current, current + 1, "...", total];
}

interface PaginationBarProps {
  from: number;
  to: number;
  total: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  jumpPage: string;
  onJumpChange: (val: string) => void;
  onJumpSubmit: (e: React.FormEvent) => void;
  onPageClick: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

function PaginationBar({
  from,
  to,
  total,
  currentPage,
  totalPages,
  pageSize,
  jumpPage,
  onJumpChange,
  onJumpSubmit,
  onPageClick,
  onPageSizeChange,
}: PaginationBarProps) {
  const pages = getPaginationRange(currentPage, totalPages);

  return (
    <div className="pagination-bar">
      <div>
        Showing <strong>{from.toLocaleString()}</strong>–<strong>{to.toLocaleString()}</strong> of{" "}
        <strong>{total.toLocaleString()}</strong> registered facilities
      </div>

      <div className="pagination-controls">
        {/* Page Size Selector */}
        <div className="pagination-pagesize">
          <label htmlFor="pageSizeSelect">Rows:</label>
          <select
            id="pageSizeSelect"
            className="pagination-select"
            value={pageSize}
            onChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
            aria-label="Rows per page"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        {/* Page Nav Buttons */}
        <div className="pagination-nav" role="navigation" aria-label="Pagination Navigation">
          <button
            type="button"
            className="pagination-btn"
            onClick={() => onPageClick(1)}
            disabled={currentPage <= 1}
            title="First page"
            aria-label="First page"
          >
            «
          </button>

          <button
            type="button"
            className="pagination-btn"
            onClick={() => onPageClick(currentPage - 1)}
            disabled={currentPage <= 1}
            title="Previous page"
            aria-label="Previous page"
          >
            ‹
          </button>

          {pages.map((p, idx) => {
            if (p === "...") {
              return (
                <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
                  &hellip;
                </span>
              );
            }
            const pageNum = p as number;
            const isActive = pageNum === currentPage;
            return (
              <button
                key={pageNum}
                type="button"
                className={`pagination-btn ${isActive ? "active" : ""}`}
                onClick={() => onPageClick(pageNum)}
                aria-current={isActive ? "page" : undefined}
                aria-label={`Page ${pageNum}`}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            type="button"
            className="pagination-btn"
            onClick={() => onPageClick(currentPage + 1)}
            disabled={currentPage >= totalPages}
            title="Next page"
            aria-label="Next page"
          >
            ›
          </button>

          <button
            type="button"
            className="pagination-btn"
            onClick={() => onPageClick(totalPages)}
            disabled={currentPage >= totalPages}
            title="Last page"
            aria-label="Last page"
          >
            »
          </button>
        </div>

        {/* Jump To Page */}
        {totalPages > 5 && (
          <form onSubmit={onJumpSubmit} className="pagination-jump">
            <label htmlFor="jumpPageInput">Go to:</label>
            <input
              id="jumpPageInput"
              type="number"
              min={1}
              max={totalPages}
              value={jumpPage}
              onChange={(e) => onJumpChange(e.target.value)}
              placeholder={String(currentPage)}
              className="pagination-jump-input"
              aria-label={`Go to page between 1 and ${totalPages}`}
            />
          </form>
        )}
      </div>
    </div>
  );
}

export function ProjectsView({
  initialProjects,
  totalProjects,
  serverPage = 1,
  serverPageSize = 20,
  initialStatus = "ALL",
  apiUrl: _apiUrl,
}: ProjectsViewProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [viewMode, setViewMode] = useState<"table" | "cards" | "map">("table");
  const [jumpPage, setJumpPage] = useState("");

  useEffect(() => {
    setStatusFilter(initialStatus);
  }, [initialStatus]);

  const totalPages = Math.max(1, Math.ceil(totalProjects / serverPageSize));
  const from = totalProjects === 0 ? 0 : (serverPage - 1) * serverPageSize + 1;
  const to = Math.min(totalProjects, serverPage * serverPageSize);

  const navigate = (page: number, size: number = serverPageSize, status: string = statusFilter) => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (size !== 20) params.set("pageSize", String(size));
    if (status && status !== "ALL") params.set("status", status);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    navigate(1, serverPageSize, newStatus);
  };

  const handlePageSizeChange = (newSize: number) => {
    navigate(1, newSize, statusFilter);
  };

  const handlePageClick = (page: number) => {
    if (page === serverPage || page < 1 || page > totalPages) return;
    navigate(page, serverPageSize, statusFilter);
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseInt(jumpPage.trim(), 10);
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      if (target !== serverPage) {
        navigate(target, serverPageSize, statusFilter);
      }
      setJumpPage("");
    }
  };

  // Filtered List for client-side search query
  const filteredProjects = useMemo(() => {
    return initialProjects.filter((p) => {
      // Text Search within page items
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const codeMatch = p.code.toLowerCase().includes(q);
        const nameMatch = p.name.toLowerCase().includes(q);
        const orgMatch = p.organisationId ? p.organisationId.toLowerCase().includes(q) : false;
        return codeMatch || nameMatch || orgMatch;
      }
      return true;
    });
  }, [initialProjects, searchQuery]);

  return (
    <div>
      {/* Clean Compact Header */}
      <div className="section-title-row" style={{ marginBottom: "1.25rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700, color: "var(--color-navy-brand)" }}>
            Projects Registry
          </h2>
          <p className="muted" style={{ marginTop: "0.15rem", fontSize: "0.82rem" }}>
            Sanctioned facilities and live monitoring status
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link
            href="/projects/new"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: "0.8rem",
              padding: "0.45rem 0.85rem",
              background: "linear-gradient(to right, var(--action-green), var(--action-green-dark))",
              color: "#ffffff",
              borderRadius: "6px",
              fontWeight: 600,
              textDecoration: "none",
              boxShadow: "0 1px 2px 0 rgba(14, 122, 52, 0.2)",
            }}
          >
            <IconPlus style={{ width: 14, height: 14 }} />
            <span>Register Project</span>
          </Link>
        </div>
      </div>

      {/* Interactive Toolbar: Search, Filters & View Toggle */}
      <div className="registry-toolbar">
        <div className="search-filter-group">
          <div className="search-input-wrap">
            <IconSearch className="search-icon-svg" style={{ width: 16, height: 16 }} />
            <input
              type="search"
              placeholder="Search facilities by Code (e.g. PRJ-DEL-001) or Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input-with-icon"
              aria-label="Filter projects registry"
            />
          </div>

          <div className="filter-tabs" role="tablist" aria-label="Status filter">
            <button
              type="button"
              className={`filter-tab-btn ${statusFilter === "ALL" ? "active" : ""}`}
              onClick={() => handleStatusChange("ALL")}
              role="tab"
              aria-selected={statusFilter === "ALL"}
            >
              <span>All</span>
              {statusFilter === "ALL" && (
                <span className="filter-count-badge">{totalProjects.toLocaleString()}</span>
              )}
            </button>
            <button
              type="button"
              className={`filter-tab-btn ${statusFilter === "Active" ? "active" : ""}`}
              onClick={() => handleStatusChange("Active")}
              role="tab"
              aria-selected={statusFilter === "Active"}
            >
              <span>Active</span>
              {statusFilter === "Active" && (
                <span className="filter-count-badge">{totalProjects.toLocaleString()}</span>
              )}
            </button>
            <button
              type="button"
              className={`filter-tab-btn ${statusFilter === "Pending Verification" ? "active" : ""}`}
              onClick={() => handleStatusChange("Pending Verification")}
              role="tab"
              aria-selected={statusFilter === "Pending Verification"}
            >
              <span>Pending</span>
              {statusFilter === "Pending Verification" && (
                <span className="filter-count-badge">{totalProjects.toLocaleString()}</span>
              )}
            </button>
            <button
              type="button"
              className={`filter-tab-btn ${statusFilter === "Draft" ? "active" : ""}`}
              onClick={() => handleStatusChange("Draft")}
              role="tab"
              aria-selected={statusFilter === "Draft"}
            >
              <span>Draft</span>
              {statusFilter === "Draft" && (
                <span className="filter-count-badge">{totalProjects.toLocaleString()}</span>
              )}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {/* View Mode Toggle */}
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
              <span>Map View</span>
            </button>
          </div>
        </div>
      </div>

      {/* View Mode A: Official Institutional Table View */}
      {viewMode === "table" && (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th style={{ width: "160px" }}>Project Identifier</th>
                <th>Facility / Project Name</th>
                <th style={{ width: "150px" }}>Classification</th>
                <th style={{ width: "160px" }}>Jurisdiction</th>
                <th style={{ width: "160px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "0.25rem" }}>
                      No matching records found
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-subtle)" }}>
                      Try adjusting the search query or status filter criteria.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProjects.map((p) => {
                  const typeLabel =
                    p.type === "institution"
                      ? "Institution / NGO"
                      : p.type === "authority_project"
                        ? "Authority Project"
                        : "General Project";

                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/projects/${p.id}`} className="code-badge">
                          {p.code}
                        </Link>
                      </td>
                      <td>
                        <Link
                          href={`/projects/${p.id}`}
                          style={{
                            fontWeight: 600,
                            color: "var(--color-navy-brand)",
                            fontSize: "0.9rem",
                            textDecoration: "none",
                          }}
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td>
                        <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                          {typeLabel}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: "0.78rem",
                            color: "var(--text-primary)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                          }}
                        >
                          <IconMapPin style={{ width: 12, height: 12, color: "var(--text-subtle)", flexShrink: 0 }} />
                          <span>{getDistrictName(p.districtId, p.code)}</span>
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={p.status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <PaginationBar
            from={from}
            to={to}
            total={totalProjects}
            currentPage={serverPage}
            totalPages={totalPages}
            pageSize={serverPageSize}
            jumpPage={jumpPage}
            onJumpChange={setJumpPage}
            onJumpSubmit={handleJumpSubmit}
            onPageClick={handlePageClick}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      )}

      {/* View Mode B: Cards Grid View */}
      {viewMode === "cards" && (
        <div>
          {filteredProjects.length === 0 ? (
            <div className="empty-box" style={{ padding: "3rem 1rem", marginBottom: "2rem" }}>
              <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "0.25rem", color: "var(--text-primary)" }}>
                No matching facilities found
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-subtle)" }}>
                Try adjusting the search query or status filter criteria.
              </div>
            </div>
          ) : (
            <div className="facility-grid">
              {filteredProjects.map((p) => {
                const typeLabel =
                  p.type === "institution"
                    ? "Institution / NGO Facility"
                    : p.type === "authority_project"
                      ? "Authority Project"
                      : "General Project";

                return (
                  <div key={p.id} className="facility-card">
                    <div className="facility-card-header">
                      <Link href={`/projects/${p.id}`} className="code-badge">
                        {p.code}
                      </Link>
                      <StatusBadge status={p.status} />
                    </div>

                    <h3 className="facility-card-title">
                      <Link href={`/projects/${p.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                        {p.name}
                      </Link>
                    </h3>

                    <p className="facility-card-desc">
                      {p.description ?? "Registered facility providing sanctioned services under central DoSJE schemes."}
                    </p>

                    <div className="facility-card-meta">
                      <span className="meta-chip">
                        <IconBuilding style={{ width: 12, height: 12 }} />
                        <span>{typeLabel}</span>
                      </span>

                      <span className="meta-chip">
                        <IconMapPin style={{ width: 12, height: 12 }} />
                        <span>{getDistrictName(p.districtId, p.code)}</span>
                      </span>

                      <span className="meta-chip">
                        <IconShieldCheck style={{ width: 12, height: 12 }} />
                        <span>{p.programmeIds.length} Schemes Linked</span>
                      </span>
                    </div>

                    <div className="facility-card-footer">
                      <span style={{ fontSize: "0.74rem", color: "var(--text-subtle)", fontWeight: 500 }}>
                        {getOrganisationName(p.organisationId, p.name)}
                      </span>

                      <Link
                        href={`/projects/${p.id}`}
                        className="btn-secondary"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          fontSize: "0.78rem",
                          padding: "0.3rem 0.7rem",
                          borderRadius: "5px",
                          textDecoration: "none",
                          fontWeight: 600,
                        }}
                      >
                        <span>Inspect Dossier</span>
                        <IconChevronRight style={{ width: 13, height: 13 }} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredProjects.length > 0 && (
            <div
              style={{
                marginTop: "1.25rem",
                borderRadius: "8px",
                overflow: "hidden",
                border: "1px solid var(--color-border-subtle)",
              }}
            >
              <PaginationBar
                from={from}
                to={to}
                total={totalProjects}
                currentPage={serverPage}
                totalPages={totalPages}
                pageSize={serverPageSize}
                jumpPage={jumpPage}
                onJumpChange={setJumpPage}
                onJumpSubmit={handleJumpSubmit}
                onPageClick={handlePageClick}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
          )}
        </div>
      )}

      {/* View Mode C: GIS Geographic Map View */}
      {viewMode === "map" && <ProjectsMapView projects={filteredProjects} />}
    </div>
  );
}
