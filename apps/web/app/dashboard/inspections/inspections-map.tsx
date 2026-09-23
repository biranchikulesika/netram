"use client";

import { useMemo } from "react";
import type { Inspection, InspectionStatus } from "@netram/types";
import { getDistrictName } from "../../../lib/presentation";
import { DISTRICT_COORDINATES } from "../projects/real-leaflet-map";
import NetramOverviewMap, { type MapFacility } from "../../components/netram-overview-map";
import { InspectionCard } from "./inspection-card";
import { IconChevronRight, IconMapPin } from "../../components/icons";

const STATUS_COLORS: Record<InspectionStatus, string> = {
  closed: "#15803d",
  under_review: "#b45309",
  in_progress: "#1d4ed8",
  evidence_collection: "#0369a1",
  submitted: "#15803d",
  findings: "#c2410c",
  corrective_actions: "#7e22ce",
  verification: "#9a3412",
  scheduled: "#4338ca",
  assigned: "#475569",
};

const ORDER: Record<InspectionStatus, number> = {
  scheduled: 0,
  assigned: 1,
  in_progress: 2,
  evidence_collection: 2,
  submitted: 3,
  under_review: 3,
  findings: 3,
  corrective_actions: 3,
  verification: 3,
  closed: 4,
};

function districtStatusColor(inspections: Inspection[]): string {
  const worst = inspections.reduce<InspectionStatus>((acc, a) => {
    return ORDER[a.status] < ORDER[acc] ? a.status : acc;
  }, inspections[0]!.status);
  return STATUS_COLORS[worst];
}

interface InspectionsMapProps {
  inspections: Inspection[];
}

interface Cluster {
  districtId: string;
  label: string;
  items: Inspection[];
  lat: number;
  lng: number;
  color: string;
}

export default function InspectionsMap({ inspections }: InspectionsMapProps) {
  const clusters = useMemo(() => {
    const byDistrict = new Map<string, Inspection[]>();
    for (const i of inspections) {
      if (!i.districtId) continue;
      const list = byDistrict.get(i.districtId) ?? [];
      list.push(i);
      byDistrict.set(i.districtId, list);
    }
    const out: Cluster[] = [];
    for (const [districtId, items] of byDistrict.entries()) {
      const district = DISTRICT_COORDINATES[districtId];
      const first = items[0]!;
      const hash = first.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const angle = (hash % 360) * (Math.PI / 180);
      const offset = 0.015 + (hash % 4) * 0.006;
      const lat = (district?.lat ?? 20.4) + Math.sin(angle) * offset;
      const lng = (district?.lng ?? 84.8) + Math.cos(angle) * offset;
      out.push({
        districtId,
        label: district?.name ?? getDistrictName(districtId, first.projectCode),
        items,
        lat,
        lng,
        color: districtStatusColor(items),
      });
    }
    return out;
  }, [inspections]);

  const facilities: MapFacility[] = useMemo(() => {
    return clusters.map((c) => ({
      id: c.districtId,
      name: c.label,
      districtId: c.districtId,
      code: `District ${c.items.length} ${c.items.length === 1 ? "inspection" : "inspections"}`,
      description: `${c.items.length} ${c.items.length === 1 ? "inspection" : "inspections"} in this district.`,
      lat: c.lat,
      lng: c.lng,
      color: c.color,
      districtLabel: c.label,
    }));
  }, [clusters]);

  const clustersById = useMemo(() => {
    const m = new Map<string, Cluster>();
    clusters.forEach((c) => m.set(c.districtId, c));
    return m;
  }, [clusters]);

  return (
    <NetramOverviewMap
      facilities={facilities}
      legend={[]}
      listTitle="Inspections"
      emptyText="No inspections match the selected filter criteria."
      reopenLabel="Inspections"
      backLabel="Back to all districts"
      renderBrowseRow={(f, select) => {
        const c = clustersById.get(f.id);
        const count = c?.items.length ?? 0;
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
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              outline: "none",
              minWidth: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#2563eb";
              e.currentTarget.style.boxShadow = "0 3px 8px rgba(37, 99, 235, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border-subtle)";
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.03)";
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
                <span style={{ fontSize: "0.66rem", fontWeight: 700, color: "var(--text-muted)" }}>
                  {count} {count === 1 ? "inspection" : "inspections"}
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
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.2rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  minWidth: 0,
                }}
                title={f.districtLabel}
              >
                <IconMapPin width={11} height={11} style={{ color: "var(--text-subtle)", flexShrink: 0 }} />
                {f.districtLabel}
              </span>
              <span style={{ flex: 1 }} />
              <span title="Open district inspections" style={{ color: "#2563eb", display: "inline-flex", flexShrink: 0 }}>
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
                {c.label}
              </h3>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "0.15rem" }}>
                {c.items.length} {c.items.length === 1 ? "inspection" : "inspections"}
              </div>
            </div>
            {c.items.map((i) => (
              <InspectionCard inspection={i} key={i.id} />
            ))}
          </div>
        );
      }}
    />
  );
}