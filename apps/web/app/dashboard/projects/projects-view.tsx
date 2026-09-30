"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import type { Project } from "@netram/types";
import { StatusBadge } from "./[id]/status-badge";
import { IconSearch, IconGrid, IconList, IconMapPin } from "../../components/icons";
import { formatDistrict } from "../../../lib/presentation";
import { ProjectsMapView } from "./projects-map-view";
import { ProjectOverviewCard, formatRegisteredDate } from "./project-overview-card";

type ProjectView = "table" | "cards" | "map";
/** Section default; any other view is recorded in the URL. */
const DEFAULT_PROJECT_VIEW: ProjectView = "map";

interface ProjectsViewProps {
  initialProjects: Project[];
  totalProjects: number;
  serverPage?: number;
  serverPageSize?: number;
  initialStatus?: string;
  initialView?: ProjectView;
  initialSearch?: string;
}

import { PaginationBar } from "../../components/pagination-bar";

import { useMediaQuery, distributeIntoColumns } from "../../../lib/card-layout";

export function ProjectsView({
  initialProjects,
  totalProjects,
  serverPage = 1,
  serverPageSize = 20,
  initialStatus = "ALL",
  initialView = DEFAULT_PROJECT_VIEW,
  initialSearch = "",
}: ProjectsViewProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [viewMode, setViewMode] = useState<ProjectView>(initialView);
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
      view?: ProjectView;
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
    if (view !== DEFAULT_PROJECT_VIEW) params.set("view", view);
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

  const handleViewModeChange = (mode: ProjectView) => {
    setViewMode(mode);
    patchUrl({ view: mode === DEFAULT_PROJECT_VIEW ? null : mode });
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
      {/* Toolbar: Search, Filters & View Toggle */}
      <div
        className="registry-toolbar"
        style={{ marginBottom: viewMode === "map" ? "0.6rem" : "1.25rem" }}
      >
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
              title="Map"
            >
              <IconMapPin style={{ width: 14, height: 14 }} />
              <span>Map</span>
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
                <th style={{ width: "12%" }}>Code</th>
                <th style={{ width: "32%" }}>Facility / Project</th>
                <th style={{ width: "13%" }}>Type</th>
                <th style={{ width: "14%" }}>Jurisdiction</th>
                <th style={{ width: "12%" }}>Registered</th>
                <th style={{ width: "10%" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty-state">
                    <IconSearch width={22} height={22} className="table-empty-icon" />
                    <div className="table-empty-title">No projects found</div>
                    <div className="table-empty-desc">
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
                      title={`Open record for ${p.name}`}
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
                          {formatDistrict(p.districtName, p.stateName)}
                        </span>
                      </td>
                      <td>
                        <span className="table-date">{formatRegisteredDate(p.createdAt)}</span>
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
            itemName="registered facilities"
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
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  marginBottom: "0.25rem",
                  color: "var(--text-primary)",
                }}
              >
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
                    <ProjectOverviewCard
                      key={p.id}
                      project={p}
                      href={`/dashboard/projects/${p.id}`}
                    />
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
              itemName="registered facilities"
              jumpPage={jumpPage}
              onJumpChange={setJumpPage}
              onJumpSubmit={handleJumpSubmit}
              onPageClick={handlePageClick}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </div>
      )}

      {/* View Mode C: Map */}
      {viewMode === "map" && (
        <div
          className="map-view-wrapper"
          style={{ height: "calc(100vh - 205px)", minHeight: "440px" }}
        >
          <ProjectsMapView projects={filteredProjects} />
        </div>
      )}
    </div>
  );
}
