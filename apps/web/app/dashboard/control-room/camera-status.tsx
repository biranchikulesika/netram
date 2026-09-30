"use client";

import { useMemo } from "react";
import type { PublicCctvCamera } from "@netram/types";
import { IconCamera, IconMapPin } from "../../components/icons";
import { formatDateTime } from "../../../lib/presentation";
import { PaginationBar, useClientPagination } from "../../components/pagination-bar";

export function formatCameraDuration(iso: string | null | undefined): string {
  if (!iso) return "-";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return "now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "under 1 min";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

// "Vani Vihar - Dormitory Block" -> ["Vani Vihar", "Dormitory Block"]
function splitFacilityPlace(name: string): [string, string] {
  const idx = name.indexOf(" - ");
  if (idx === -1) return [name, ""];
  return [name.slice(0, idx), name.slice(idx + 3)];
}

type StatusFilter = "all" | "online" | "offline";

interface CameraStatusViewProps {
  cameras: PublicCctvCamera[];
  /** districtId -> district name, resolved server-side. */
  districtNames?: Record<string, string>;
  /** All / Online / Offline filter chosen via the header filter tabs. */
  filter?: StatusFilter;
  /** Live-filter query from the shared control-room search bar. */
  query?: string;
}

export function CameraStatusView({
  cameras,
  districtNames = {},
  filter = "all",
  query = "",
}: CameraStatusViewProps) {
  const q = query.trim().toLowerCase();

  /** Rows with derived display fields, filtered by the shared search. */
  const rows = useMemo(() => {
    const withMeta = cameras.map((cam) => {
      const [facility, place] = splitFacilityPlace(cam.name);
      return {
        cam,
        facility,
        place,
        district: cam.districtId ? (districtNames[cam.districtId] ?? "Unknown district") : "-",
      };
    });
    if (!q) return withMeta;
    return withMeta.filter(
      (r) =>
        r.cam.name.toLowerCase().includes(q) ||
        r.facility.toLowerCase().includes(q) ||
        r.district.toLowerCase().includes(q),
    );
  }, [cameras, districtNames, q]);

  /** All / Online / Offline filter (mirrors the Alerts Active/Resolved tabs). */
  const filteredRows = useMemo(() => {
    if (filter === "online") return rows.filter((r) => r.cam.status === "active");
    if (filter === "offline") return rows.filter((r) => r.cam.status !== "active");
    return rows;
  }, [rows, filter]);

  /** Facility groups sorted so facilities with problems appear first. */
  const facilityGroups = useMemo(() => {
    const map = new Map<string, typeof filteredRows>();
    for (const r of filteredRows) {
      const key = `${r.facility}|${r.district}`;
      const list = map.get(key);
      if (list) list.push(r);
      else map.set(key, [r]);
    }
    return [...map.entries()]
      .map(([key, cams]) => ({
        key,
        facility: cams[0]!.facility,
        district: cams[0]!.district,
        cams,
        offlineCount: cams.filter((c) => c.cam.status !== "active").length,
      }))
      .sort(
        (a, b) =>
          b.offlineCount - a.offlineCount ||
          b.cams.length - a.cams.length ||
          a.facility.localeCompare(b.facility),
      );
  }, [filteredRows]);

  const pagination = useClientPagination(facilityGroups, 10, [filter, query]);

  return (
    <section>
      {cameras.length === 0 ? (
        <div className="table-empty-state">
          <IconCamera className="table-empty-icon" />
          <div className="table-empty-title">No Cameras Available</div>
          <div className="table-empty-desc">No CCTV cameras are configured for your authorized jurisdiction.</div>
        </div>
      ) : rows.length === 0 ? (
        <div className="table-empty-state">
          <IconCamera className="table-empty-icon" />
          <div className="table-empty-title">No matching cameras</div>
          <div className="table-empty-desc">Nothing matches &quot;{query}&quot; in camera name, facility or district.</div>
        </div>
      ) : (
        <div className="table-card">
          <table className="status-table">
            <thead>
              <tr>
                <th>Camera</th>
                <th>Status</th>
                <th>Last Updated</th>
                <th>Outage Duration</th>
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedItems.flatMap((group) => [
                <tr key={group.key} className="status-group-row">
                  <td colSpan={4}>
                    <span className="status-group-title">
                      <IconMapPin style={{ width: 12, height: 12 }} />
                      {group.facility}
                    </span>
                    <span className="status-group-meta">
                      {group.district} · {group.cams.length} camera{group.cams.length === 1 ? "" : "s"}
                      {group.offlineCount > 0 && (
                        <span className="status-group-problem"> · {group.offlineCount} down</span>
                      )}
                    </span>
                  </td>
                </tr>,
                ...group.cams.map((r) => {
                  const isDown = r.cam.status !== "active";
                  return (
                    <tr key={r.cam.id} className="table-row">
                      <td className="status-cam-name">{r.place || r.cam.name}</td>
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            color:
                              r.cam.status === "active"
                                ? "#137e3a"
                                : r.cam.status === "inactive"
                                  ? "#dc2626"
                                  : "#dd501e",
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              backgroundColor:
                                r.cam.status === "active"
                                  ? "#137e3a"
                                  : r.cam.status === "inactive"
                                    ? "#dc2626"
                                    : "#dd501e",
                            }}
                          />
                          {r.cam.status === "active" ? "Live" : r.cam.status === "inactive" ? "Offline" : "Maintenance"}
                        </span>
                      </td>
                      <td className="table-date">{formatDateTime(r.cam.updatedAt)}</td>
                      <td className="table-date">
                        {isDown ? formatCameraDuration(r.cam.updatedAt) : "-"}
                      </td>
                    </tr>
                  );
                }),
              ])}
            </tbody>
          </table>

          <PaginationBar
            from={pagination.from}
            to={pagination.to}
            total={pagination.total}
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            pageSize={pagination.pageSize}
            itemName="facility groups"
            onPageClick={pagination.onPageClick}
            onPageSizeChange={pagination.onPageSizeChange}
          />
        </div>
      )}
    </section>
  );
}
