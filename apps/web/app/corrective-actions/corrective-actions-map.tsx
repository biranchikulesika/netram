"use client";

import { useMemo } from "react";
import type { CorrectiveAction, CorrectiveActionStatus } from "@netram/types";
import { getDistrictName } from "../../lib/presentation";
import { DISTRICT_COORDINATES, parseGpsCoordinates } from "../projects/real-leaflet-map";
import NetramOverviewMap, {
  type MapFacility,
} from "../components/netram-overview-map";
import { CorrectiveActionCard } from "./corrective-action-card";
import { IconMapPin, IconChevronRight } from "../components/icons";

const STATUS_COLORS: Record<CorrectiveActionStatus, string> = {
  pending: "#64748b",
  rejected: "#b91c1c",
  submitted: "#0369a1",
  under_review: "#b45309",
  accepted: "#15803d",
  overdue: "#c2410c",
  escalated: "#7e22ce",
};

const ORDER: Record<CorrectiveActionStatus, number> = {
  escalated: 0,
  overdue: 1,
  pending: 2,
  rejected: 2,
  submitted: 3,
  under_review: 3,
  accepted: 4,
};

function projectStatusColor(actions: CorrectiveAction[]): string {
  const worst = actions.reduce<CorrectiveActionStatus>((acc, a) => {
    return ORDER[a.status] < ORDER[acc] ? a.status : acc;
  }, actions[0]!.status);
  return STATUS_COLORS[worst];
}

function resolveLocation(action: CorrectiveAction): { lat: number; lng: number } {
  const project = action.project;
  const parsed = project ? parseGpsCoordinates(project.description) : null;
  if (parsed) return parsed;

  const district = project?.districtId ? DISTRICT_COORDINATES[project.districtId] : null;
  const baseLat = district?.lat ?? 20.4;
  const baseLng = district?.lng ?? 84.8;

  const hash = action.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const angle = (hash % 360) * (Math.PI / 180);
  const offset = 0.008 + (hash % 5) * 0.004;
  return { lat: baseLat + Math.sin(angle) * offset, lng: baseLng + Math.cos(angle) * offset };
}

interface CorrectiveActionsMapProps {
  actions: CorrectiveAction[];
}

interface Cluster {
  projectId: string;
  project: NonNullable<CorrectiveAction["project"]>;
  items: CorrectiveAction[];
  lat: number;
  lng: number;
  color: string;
}

export default function CorrectiveActionsMap({ actions }: CorrectiveActionsMapProps) {
  const clusters = useMemo(() => {
    const byProject = new Map<string, CorrectiveAction[]>();
    for (const a of actions) {
      if (!a.project) continue;
      const list = byProject.get(a.project.id) ?? [];
      list.push(a);
      byProject.set(a.project.id, list);
    }
    const out: Cluster[] = [];
    for (const [projectId, items] of byProject.entries()) {
      const first = items[0]!;
      const loc = resolveLocation(first);
      out.push({ projectId, project: first.project!, items, ...loc, color: projectStatusColor(items) });
    }
    return out.filter((c) => c.lat && c.lng);
  }, [actions]);

  const facilities: MapFacility[] = useMemo(() => {
    return clusters.map((c) => ({
      id: c.projectId,
      name: c.project.name,
      code: c.project.code,
      districtId: c.project.districtId,
      description: c.project.description,
      lat: c.lat,
      lng: c.lng,
      color: c.color,
      districtLabel: getDistrictName(c.project.districtId, c.project.code),
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
      listTitle="Corrective Actions"
      emptyText="No corrective actions match the selected filter criteria."
      reopenLabel="Corrective Actions"
      backLabel="Back to all facilities"
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
                <span
                  style={{ fontSize: "0.66rem", fontWeight: 700, color: "var(--text-muted)" }}
                  title={`${count} corrective ${count === 1 ? "action" : "actions"}`}
                >
                  {count} {count === 1 ? "action" : "actions"}
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
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  flexShrink: 0,
                }}
                title={`Project Identifier: ${f.code}`}
              >
                {f.code}
              </span>
              <span style={{ flexShrink: 0, opacity: 0.6 }}>·</span>
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
              <span title="Open facility details" style={{ color: "#2563eb", display: "inline-flex", flexShrink: 0 }}>
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
                {c.project.name}
              </h3>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "0.15rem" }}>
                {c.project.code} · {c.items.length} corrective {c.items.length === 1 ? "action" : "actions"}
              </div>
            </div>
            {c.items.map((ca) => (
              <CorrectiveActionCard ca={ca} key={ca.id} />
            ))}
          </div>
        );
      }}
    />
  );
}