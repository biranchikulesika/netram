"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import type { Project } from "@netram/types";
import { StatusBadge } from "./[id]/status-badge";
import {
  IconSearch,
  IconGrid,
  IconList,
  IconMapPin,
  IconTag,
  IconBuilding,
  IconGavel,
  IconChevronRight,
  IconCheck,
  IconX,
  IconClock,
  IconShieldCheck,
} from "../../components/icons";
import { getDistrictName } from "../../../lib/presentation";
import { ProjectsMapView } from "./projects-map-view";
import { ProjectOverviewCard, formatRegisteredDate } from "./project-overview-card";

interface ProjectsViewProps {
  initialProjects: Project[];
  totalProjects: number;
  serverPage?: number;
  serverPageSize?: number;
  initialStatus?: string;
  initialView?: "table" | "cards" | "map";
  initialSearch?: string;
  /** Registrations awaiting an approve/reject decision (only passed to approvers). */
  verificationQueue?: Project[];
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

import { useMediaQuery, distributeIntoColumns } from "../../../lib/card-layout";

export function ProjectsView({
  initialProjects,
  totalProjects,
  serverPage = 1,
  serverPageSize = 20,
  initialStatus = "ALL",
  initialView = "table",
  initialSearch = "",
  verificationQueue,
  apiUrl: _apiUrl,
}: ProjectsViewProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [viewMode, setViewMode] = useState<"table" | "cards" | "map">(initialView);
  const [jumpPage, setJumpPage] = useState("");

  useEffect(() => {
    setStatusFilter(initialStatus);
  }, [initialStatus]);

  const totalPages = Math.max(1, Math.ceil(totalProjects / serverPageSize));
  const from = totalProjects === 0 ? 0 : (serverPage - 1) * serverPageSize + 1;
  const to = Math.min(totalProjects, serverPage * serverPageSize);

  /** Every navigation serializes the full UI state (page, size, status, view, search) into the URL. */
  const navigate = (
    overrides: {
      page?: number;
      pageSize?: number;
      status?: string;
      view?: "table" | "cards" | "map";
      q?: string;
    } = {},
  ) => {
    const params = new URLSearchParams();
    const page = overrides.page ?? serverPage;
    const size = overrides.pageSize ?? serverPageSize;
    const status = overrides.status ?? statusFilter;
    const view = overrides.view ?? viewMode;
    const q = overrides.q ?? searchQuery;

    if (page > 1) params.set("page", String(page));
    if (size !== 20) params.set("pageSize", String(size));
    if (status && status !== "ALL") params.set("status", status);
    if (view !== "table") params.set("view", view);
    if (q.trim()) params.set("q", q.trim());

    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  /** Client-only controls (search text, view toggle) update the URL without a server round-trip. */
  const patchUrl = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    navigate({ page: 1, status: newStatus });
  };

  const handlePageSizeChange = (newSize: number) => {
    navigate({ page: 1, pageSize: newSize });
  };

  const handlePageClick = (page: number) => {
    if (page === serverPage || page < 1 || page > totalPages) return;
    navigate({ page });
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseInt(jumpPage.trim(), 10);
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      if (target !== serverPage) {
        navigate({ page: target });
      }
      setJumpPage("");
    }
  };

  const handleViewModeChange = (mode: "table" | "cards" | "map") => {
    setViewMode(mode);
    patchUrl({ view: mode === "table" ? null : mode });
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    patchUrl({ q: value.trim() || null });
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

  // Column count for the masonry cards grid (keeps left-to-right fill order)
  const isXl = useMediaQuery("(min-width: 1401px)");
  const isLg = useMediaQuery("(min-width: 1101px) and (max-width: 1400px)");
  const isMd = useMediaQuery("(min-width: 641px) and (max-width: 1100px)");
  const columnCount = isXl ? 4 : isLg ? 3 : isMd ? 2 : 1;
  const cardColumns = useMemo(
    () => distributeIntoColumns(filteredProjects, columnCount),
    [filteredProjects, columnCount],
  );

  return (
    <div>
      {/* Verification queue — authority officials decide pending registrations here */}
      {verificationQueue && verificationQueue.length > 0 && (
        <VerificationQueueSection projects={verificationQueue} />
      )}

      {/* Toolbar: Search, Filters & View Toggle */}
      <div className="registry-toolbar" style={{ marginBottom: viewMode === "map" ? "0.6rem" : "1.25rem" }}>
        <div className="search-filter-group">
          <div className="search-input-wrap">
            <IconSearch className="search-icon-svg" style={{ width: 16, height: 16 }} />
            <input
              type="search"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
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
              onClick={() => handleViewModeChange("table")}
              title="Table View"
            >
              <IconList style={{ width: 14, height: 14 }} />
              <span>Table</span>
            </button>
            <button
              type="button"
              className={`view-btn ${viewMode === "cards" ? "active" : ""}`}
              onClick={() => handleViewModeChange("cards")}
              title="Cards View"
            >
              <IconGrid style={{ width: 14, height: 14 }} />
              <span>Cards</span>
            </button>
            <button
              type="button"
              className={`view-btn ${viewMode === "map" ? "active" : ""}`}
              onClick={() => handleViewModeChange("map")}
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
        <div className="table-card table-card-projects">
          <table className="projects-table">
            <thead>
              <tr>
                <th style={{ width: "12%" }}>
                  <span className="th-icon" title="Project identifier"><IconTag width={12} height={12} /></span>
                  Code
                </th>
                <th style={{ width: "32%" }}>Facility / Project</th>
                <th style={{ width: "13%" }}>
                  <span className="th-icon" title="Classification"><IconBuilding width={12} height={12} /></span>
                  Type
                </th>
                <th style={{ width: "14%" }}>
                  <span className="th-icon" title="Jurisdiction district"><IconGavel width={12} height={12} /></span>
                  Jurisdiction
                </th>
                <th style={{ width: "12%" }}>Registered</th>
                <th style={{ width: "10%" }}>Status</th>
                <th style={{ width: "3%" }} aria-hidden="true"></th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
                    <IconSearch width={22} height={22} style={{ opacity: 0.5, margin: "0 auto 0.5rem", display: "block" }} />
                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>No projects found</div>
                    <div style={{ fontSize: "0.78rem", marginTop: "0.25rem" }}>
                      Adjust the status filter or search query to see more of the registry.
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
                    <tr
                      key={p.id}
                      className="table-row"
                      onClick={() => router.push(`/dashboard/projects/${p.id}`)}
                      title={`Open dossier for ${p.name}`}
                    >
                      <td>
                        <Link
                          href={`/dashboard/projects/${p.id}`}
                          className="table-code-link"
                          onClick={(e) => e.stopPropagation()}
                          title={`Project identifier: ${p.code}`}
                        >
                          {p.code}
                        </Link>
                      </td>
                      <td>
                        <Link
                          href={`/dashboard/projects/${p.id}`}
                          className="table-name-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td>
                        <span className="table-type">{typeLabel}</span>
                      </td>
                      <td>
                        <span className="table-jurisdiction">
                          {getDistrictName(p.districtId, p.code)}
                        </span>
                      </td>
                      <td>
                        <span className="table-date">{formatRegisteredDate(p.createdAt)}</span>
                      </td>
                      <td>
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="table-chevron-cell" aria-hidden="true">
                        <IconChevronRight width={14} height={14} className="table-chevron" />
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
            <div className="facility-cards-grid">
              {cardColumns.map((column, colIdx) => (
                <div className="facility-cards-column" key={colIdx}>
                  {column.map((p) => (
                    <ProjectOverviewCard key={p.id} project={p} href={`/dashboard/projects/${p.id}`} />
                  ))}
                </div>
              ))}
            </div>
          )}

          {filteredProjects.length > 0 && (
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
          )}
        </div>
      )}

      {/* View Mode C: GIS Geographic Map View */}
      {viewMode === "map" && (
        <div className="map-view-wrapper" style={{ height: "calc(100vh - 205px)", minHeight: "440px" }}>
          <ProjectsMapView projects={filteredProjects} />
        </div>
      )}
    </div>
  );
}

/* ---------------- Verification queue ---------------- */

interface QueueRowState {
  busy: boolean;
  error: string | null;
  done: "Approved" | "Rejected" | null;
}

/**
 * Registrations awaiting an authority verification decision. Visible only to
 * users holding project:approve (server enforces the same rule); actions go
 * through the standard transition endpoint which re-checks permission and
 * jurisdiction server-side.
 */
function VerificationQueueSection({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [rowState, setRowState] = useState<Record<string, QueueRowState>>({});

  const visible = projects.filter(
    (p) => rowState[p.id]?.done !== "Approved" && rowState[p.id]?.done !== "Rejected",
  );
  if (visible.length === 0) {
    // All decisions made — nothing to show.
    return null;
  }

  async function decide(projectId: string, to: "Approved" | "Draft", kind: "Approved" | "Rejected") {
    setRowState((s) => ({ ...s, [projectId]: { busy: true, error: null, done: null } }));
    try {
      const res = await fetch(`/api/projects/${projectId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: { code?: string; message?: string };
      } | null;
      if (!res.ok || payload?.error) {
        setRowState((s) => ({
          ...s,
          [projectId]: { busy: false, error: payload?.error?.message ?? `Request failed (${res.status})`, done: null },
        }));
        return;
      }
      setRowState((s) => ({ ...s, [projectId]: { busy: false, error: null, done: kind } }));
      router.refresh();
    } catch (err) {
      setRowState((s) => ({
        ...s,
        [projectId]: { busy: false, error: err instanceof Error ? err.message : String(err), done: null },
      }));
    }
  }

  return (
    <section className="verification-queue" aria-label="Registrations awaiting verification">
      <div className="vq-head">
        <span className="vq-head-icon">
          <IconShieldCheck width={15} height={15} />
        </span>
        <div className="vq-head-titles">
          <h2>Awaiting verification</h2>
          <p>
            {visible.length} registration{visible.length === 1 ? "" : "s"} submitted for your decision.
          </p>
        </div>
      </div>

      <div className="vq-list">
        {visible.map((p) => {
          const st = rowState[p.id] ?? { busy: false, error: null, done: null };
          return (
            <div className={`vq-row ${st.done ? "vq-row-done" : ""}`} key={p.id}>
              <div className="vq-main">
                <Link href={`/dashboard/projects/${p.id}`} className="vq-name" title={p.name}>
                  {p.name}
                </Link>
                <div className="vq-meta">
                  <span className="vq-code">{p.code}</span>
                  <span className="vq-meta-sep">·</span>
                  <span>{getDistrictName(p.districtId, p.code)}</span>
                  <span className="vq-meta-sep">·</span>
                  <span>Regd. {formatRegisteredDate(p.createdAt)}</span>
                </div>
              </div>

              {st.error && <div className="vq-error" role="alert">{st.error}</div>}

              <div className="vq-actions">
                <button
                  type="button"
                  className="vq-btn vq-btn-approve"
                  disabled={st.busy}
                  onClick={() => decide(p.id, "Approved", "Approved")}
                  title="Approve registration"
                >
                  <IconCheck width={13} height={13} />
                  {st.busy ? "…" : "Approve"}
                </button>
                <button
                  type="button"
                  className="vq-btn vq-btn-reject"
                  disabled={st.busy}
                  onClick={() => decide(p.id, "Draft", "Rejected")}
                  title="Send back to draft for correction"
                >
                  <IconX width={13} height={13} />
                  Reject
                </button>
                <Link href={`/dashboard/projects/${p.id}`} className="vq-review-link" title="Review full dossier before deciding">
                  Review
                </Link>
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <div className="vq-empty">
            <IconClock width={14} height={14} />
            All caught up — no registrations awaiting verification.
          </div>
        )}
      </div>
    </section>
  );
}
