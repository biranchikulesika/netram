"use client";

import { useMemo } from "react";
import type { Complaint, ComplaintStatus } from "@netram/types";
import { formatDistrict } from "../../../lib/presentation";
import { DISTRICT_COORDINATES } from "../projects/real-leaflet-map";
import NetramOverviewMap, {
  type MapFacility,
} from "../../components/netram-overview-map";
import { ComplaintCard } from "./complaint-card";
import { IconMapPin, IconChevronRight } from "../../components/icons";

const STATUS_COLORS: Record<ComplaintStatus, string> = {
  received: "#0c2a52",
  under_review: "#dd501e",
  escalated: "#dc2626",
  resolved: "#137e3a",
  closed: "var(--text-muted)",
};

const ORDER: Record<ComplaintStatus, number> = {
  escalated: 0,
  under_review: 1,
  received: 2,
  closed: 3,
  resolved: 4,
};

function clusterColor(complaints: Complaint[]): string {
  const worst = complaints.reduce<ComplaintStatus>((acc, c) => {
    return ORDER[c.status] < ORDER[acc] ? c.status : acc;
  }, complaints[0]!.status);
  return STATUS_COLORS[worst];
}

function resolveLocation(complaint: Complaint): { lat: number; lng: number } {
  const district = complaint.districtId ? DISTRICT_COORDINATES[complaint.districtId] : null;
  const baseLat = district?.lat ?? 20.4;
  const baseLng = district?.lng ?? 84.8;

  const hash = complaint.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const angle = (hash % 360) * (Math.PI / 180);
  const offset = 0.008 + (hash % 5) * 0.004;
  return { lat: baseLat + Math.sin(angle) * offset, lng: baseLng + Math.cos(angle) * offset };
}

interface ComplaintsMapProps {
  complaints: Complaint[];
}

interface Cluster {
  projectId: string;
  complaints: Complaint[];
  lat: number;
  lng: number;
  color: string;
}

export default function ComplaintsMap({ complaints }: ComplaintsMapProps) {
  const clusters = useMemo(() => {
    const byProject = new Map<string, Complaint[]>();
    for (const c of complaints) {
      const list = byProject.get(c.projectId) ?? [];
      list.push(c);
      byProject.set(c.projectId, list);
    }
    const out: Cluster[] = [];
    for (const [projectId, items] of byProject.entries()) {
      const first = items[0]!;
      const loc = resolveLocation(first);
      out.push({ projectId, complaints: items, ...loc, color: clusterColor(items) });
    }
    return out.filter((c) => c.lat && c.lng);
  }, [complaints]);

  const facilities: MapFacility[] = useMemo(() => {
    return clusters.map((c) => ({
      id: c.projectId,
      name: c.complaints[0]!.projectName,
      code: c.complaints[0]!.projectCode,
      districtId: c.complaints[0]!.districtId,
      description: `${c.complaints.length} grievance${c.complaints.length === 1 ? "" : "s"}`,
      lat: c.lat,
      lng: c.lng,
      color: c.color,
      districtLabel: formatDistrict(c.complaints[0]!.districtName),
    }));
  }, [clusters]);

  const clustersById = useMemo(() => {
    const m = new Map<string, Cluster>();
    clusters.forEach((c) => m.set(c.projectId, c));
    return m;
  }, [clusters]);

  return (
    <NetramOverviewMap
      facilities={facilities}
      legend={[]}
      listTitle="Complaints & Grievances"
      emptyText="No grievances match the selected filter criteria."
      reopenLabel="Complaints"
      backLabel="Back to all facilities"
      renderBrowseRow={(f, select) => {
        const c = clustersById.get(f.id);
        const count = c?.complaints.length ?? 0;
        return (
          <div
            role="button"
            tabIndex={0}
            onClick={() => select(f)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                select(f);
              }
            }}
            style={{
              padding: "0.5rem 0.6rem",
              borderRadius: "8px",
              border: "1px solid var(--color-border-subtle)",
              background: "#ffffff",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: "0.15rem",
              transition: "all 0.15s ease",
              boxShadow: "0 1px 3px rgba(0,36,73, 0.03)",
              outline: "none",
              minWidth: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#0c2a52";
              e.currentTarget.style.boxShadow = "0 3px 8px rgba(12,42,82, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border-subtle)";
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,36,73, 0.03)";
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.4rem",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "var(--color-navy-brand)",
                  lineHeight: 1.3,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  minWidth: 0,
                }}
                title={f.name}
              >
                {f.name}
              </div>
              <div style={{ flexShrink: 0 }}>
                <span style={{ fontSize: "0.66rem", fontWeight: 700, color: "var(--text-muted)" }} title={`${count} grievance${count === 1 ? "" : "s"}`}>
                  {count} grievance{count === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                fontSize: "0.68rem",
                color: "var(--text-muted)",
                minWidth: 0,
              }}
            >
              <span style={{ fontWeight: 600, flexShrink: 0 }} title={`Facility Code: ${f.code}`}>
                {f.code}
              </span>
              <span style={{ flexShrink: 0, opacity: 0.6 }}>·</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }} title={f.districtLabel}>
                <IconMapPin width={11} height={11} style={{ color: "var(--text-subtle)", flexShrink: 0 }} />
                {f.districtLabel}
              </span>
              <span style={{ flex: 1 }} />
              <span title="Open facility details" style={{ color: "#0c2a52", display: "inline-flex", flexShrink: 0 }}>
                <IconChevronRight width={13} height={13} />
              </span>
            </div>
          </div>
        );
      }}
      renderDrawerContent={(f) => {
        const c = clustersById.get(f.id);
        if (!c) return null;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--color-navy-brand)" }}>
                {c.complaints[0]!.projectName}
              </h3>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                {c.complaints[0]!.projectCode} · {c.complaints.length} grievance{c.complaints.length === 1 ? "" : "s"}
              </div>
            </div>
            {c.complaints.map((complaint) => (
              <ComplaintCard complaint={complaint} key={complaint.id} />
            ))}
          </div>
        );
      }}
    />
  );
}