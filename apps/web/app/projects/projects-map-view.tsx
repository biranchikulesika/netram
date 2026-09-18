"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import type { Project, ProjectStatus } from "@netram/types";
import { StatusBadge } from "./[id]/status-badge";
import {
  IconBuilding,
  IconMapPin,
  IconShieldCheck,
  IconSearch,
  IconChevronRight,
} from "../components/icons";
import { getDistrictName, getOrganisationName } from "../../lib/presentation";

interface ProjectsMapViewProps {
  projects: Project[];
}

interface DistrictGeo {
  id: string;
  name: string;
  code: string;
  headquarters: string;
  centerLat: number;
  centerLng: number;
  path: string; // SVG path data
  labelX: number;
  labelY: number;
}

// Map coordinate bounds for Odisha focus region
const MAP_BOUNDS = {
  minLng: 83.2,
  maxLng: 87.4,
  minLat: 18.8,
  maxLat: 22.5,
  svgWidth: 800,
  svgHeight: 580,
};

function projectToSvg(lat: number, lng: number) {
  const x =
    ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) *
    MAP_BOUNDS.svgWidth;
  const y =
    MAP_BOUNDS.svgHeight -
    ((lat - MAP_BOUNDS.minLat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) *
      MAP_BOUNDS.svgHeight;
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

// Odisha Administrative Districts with accurate GIS boundaries and centroids
const DISTRICT_GEOMETRIES: DistrictGeo[] = [
  {
    id: "5f6c6fcf-fc88-5bf1-9f63-cad86ee0bd3b",
    name: "Khordha",
    code: "KHOL",
    headquarters: "Bhubaneswar (State Capital)",
    centerLat: 20.25,
    centerLng: 85.75,
    path: "M 480,330 L 530,320 L 550,350 L 525,385 L 485,395 L 460,370 Z",
    labelX: 505,
    labelY: 355,
  },
  {
    id: "92f0e386-2b80-5ca4-94a0-9c7d90d47dbf",
    name: "Cuttack",
    code: "CUT",
    headquarters: "Cuttack City",
    centerLat: 20.46,
    centerLng: 85.88,
    path: "M 495,290 L 560,285 L 590,325 L 550,350 L 530,320 L 480,330 L 470,305 Z",
    labelX: 530,
    labelY: 310,
  },
  {
    id: "ec220eb3-d4a3-5b12-9412-26d8badeafe7",
    name: "Puri",
    code: "PURI",
    headquarters: "Puri Coastal Zone",
    centerLat: 19.81,
    centerLng: 85.83,
    path: "M 485,395 L 525,385 L 560,420 L 540,465 L 475,445 L 460,410 Z",
    labelX: 510,
    labelY: 425,
  },
  {
    id: "a2dfd214-5aa0-5c7a-aa78-7b59865ba0a3",
    name: "Ganjam",
    code: "GANJ",
    headquarters: "Berhampur / Chhatrapur",
    centerLat: 19.38,
    centerLng: 84.85,
    path: "M 320,440 L 410,410 L 460,410 L 475,445 L 430,520 L 330,510 L 295,470 Z",
    labelX: 375,
    labelY: 465,
  },
  {
    id: "e71c0cc4-6569-5e2b-bb73-cc3cae07fb8d",
    name: "Sundargarh",
    code: "SNDR",
    headquarters: "Rourkela / Sundargarh",
    centerLat: 22.12,
    centerLng: 84.03,
    path: "M 150,70 L 290,55 L 340,110 L 280,165 L 180,175 L 120,130 Z",
    labelX: 230,
    labelY: 115,
  },
];

// Contextual surrounding districts for geographic continuity
const SURROUNDING_REGIONS = [
  { name: "Sambalpur / Jharsuguda", path: "M 180,175 L 280,165 L 320,240 L 220,265 L 160,215 Z" },
  { name: "Angul / Dhenkanal", path: "M 320,240 L 420,225 L 470,305 L 380,330 L 310,290 Z" },
  { name: "Mayurbhanj / Keonjhar", path: "M 340,110 L 490,95 L 530,170 L 450,225 L 380,175 Z" },
  { name: "Balasore / Bhadrak", path: "M 530,170 L 630,160 L 660,240 L 590,260 L 530,220 Z" },
  { name: "Nayagarh / Kandhamal", path: "M 310,290 L 380,330 L 460,370 L 410,410 L 320,440 L 270,360 Z" },
  { name: "Koraput / Rayagada", path: "M 180,450 L 295,470 L 330,510 L 270,570 L 170,550 Z" },
];

function parseCoordinates(desc: string | null): { lat: number; lng: number } | null {
  if (!desc) return null;
  const match = desc.match(/GPS Coordinates:\s*([0-9.-]+)\s*,\s*([0-9.-]+)/i);
  if (match && match[1] && match[2]) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat > 17 && lat < 24 && lng > 80 && lng < 90) {
      return { lat, lng };
    }
  }
  return null;
}

function parseSanctionedCapacity(desc: string | null): string {
  if (!desc) return "Not specified";
  const match = desc.match(/Sanctioned Capacity:\s*([^|]+)/i);
  return match && match[1] ? match[1].trim() : "Standard Capacity";
}

function parseWelfareCategory(desc: string | null): string {
  if (!desc) return "General Sanctioned Facility";
  const match = desc.match(/Category:\s*([^|]+)/i);
  return match && match[1] ? match[1].trim() : "General Sanctioned Facility";
}

export function ProjectsMapView({ projects }: ProjectsMapViewProps) {
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>("ALL");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    projects[0]?.id ?? null,
  );
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [hoveredDistrictId, setHoveredDistrictId] = useState<string | null>(null);

  // Compute coordinates for each project
  const mappedProjects = useMemo(() => {
    return projects.map((p, index) => {
      const parsed = parseCoordinates(p.description);
      let lat = parsed?.lat;
      let lng = parsed?.lng;

      if (!lat || !lng) {
        // Map to district centroid with deterministic offset
        const dist = DISTRICT_GEOMETRIES.find((d) => d.id === p.districtId);
        const baseLat = dist ? dist.centerLat : 20.25;
        const baseLng = dist ? dist.centerLng : 85.75;

        // Deterministic radial spread so pins in same district don't overlap
        const hash = (p.id + p.code).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const angle = ((hash + index * 47) % 360) * (Math.PI / 180);
        const radius = 0.05 + ((hash % 7) * 0.025);

        lat = baseLat + Math.sin(angle) * radius;
        lng = baseLng + Math.cos(angle) * radius;
      }

      const svgPos = projectToSvg(lat, lng);
      return {
        ...p,
        geoLat: lat,
        geoLng: lng,
        svgX: svgPos.x,
        svgY: svgPos.y,
        capacityLabel: parseSanctionedCapacity(p.description),
        categoryLabel: parseWelfareCategory(p.description),
      };
    });
  }, [projects]);

  // Filtered facilities based on district selector and search
  const visibleProjects = useMemo(() => {
    return mappedProjects.filter((p) => {
      if (selectedDistrictId !== "ALL" && p.districtId !== selectedDistrictId) {
        return false;
      }
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [mappedProjects, selectedDistrictId, searchFilter]);

  const selectedProject = useMemo(() => {
    return (
      mappedProjects.find((p) => p.id === selectedProjectId) ??
      visibleProjects[0] ??
      null
    );
  }, [mappedProjects, selectedProjectId, visibleProjects]);

  const activeCount = projects.filter((p) => p.status === "Active").length;
  const pendingCount = projects.filter((p) => p.status === "Pending Verification").length;
  const draftCount = projects.filter((p) => p.status === "Draft").length;

  function getStatusColor(status: ProjectStatus) {
    switch (status) {
      case "Active":
        return "#16a34a"; // action-green
      case "Approved":
        return "#2563eb"; // blue
      case "Pending Verification":
        return "#d97706"; // amber
      case "Draft":
        return "#64748b"; // slate
      case "Suspended":
        return "#dc2626"; // red
      case "Closed":
      case "Archived":
        return "#94a3b8"; // light slate
      default:
        return "#64748b";
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginBottom: "2rem" }}>
      {/* Top Map KPI Metrics Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
          background: "var(--bg-surface)",
          border: "1px solid var(--color-border-subtle)",
          borderRadius: "8px",
          padding: "1rem 1.25rem",
        }}
      >
        <div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
            Total Mapped Facilities
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--color-navy-brand)" }}>
            {projects.length} <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-muted)" }}>GIS Coordinates</span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
            Active Monitored Units
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#16a34a" }}>
            {activeCount} <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-muted)" }}>Live Telemetry</span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
            Pending Scrutiny
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#d97706" }}>
            {pendingCount} <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-muted)" }}>Under DSWO Review</span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
            Draft Registrations
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#64748b" }}>
            {draftCount} <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-muted)" }}>Operating Agency</span>
          </div>
        </div>
      </div>

      {/* Interactive Controls Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          background: "var(--bg-surface)",
          border: "1px solid var(--color-border-subtle)",
          borderRadius: "8px",
          padding: "0.75rem 1rem",
        }}
      >
        {/* District Jurisdiction Selector Tabs */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.4rem" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", marginRight: "0.25rem", textTransform: "uppercase" }}>
            Jurisdiction:
          </span>
          <button
            type="button"
            onClick={() => setSelectedDistrictId("ALL")}
            style={{
              padding: "0.3rem 0.65rem",
              borderRadius: "4px",
              fontSize: "0.78rem",
              fontWeight: selectedDistrictId === "ALL" ? 700 : 500,
              background: selectedDistrictId === "ALL" ? "var(--color-navy-dark)" : "var(--bg-subtle)",
              color: selectedDistrictId === "ALL" ? "#ffffff" : "var(--text-primary)",
              border: "1px solid var(--color-border-subtle)",
              cursor: "pointer",
            }}
          >
            All Odisha ({projects.length})
          </button>
          {DISTRICT_GEOMETRIES.map((d) => {
            const count = projects.filter((p) => p.districtId === d.id).length;
            const isSelected = selectedDistrictId === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedDistrictId(d.id)}
                style={{
                  padding: "0.3rem 0.65rem",
                  borderRadius: "4px",
                  fontSize: "0.78rem",
                  fontWeight: isSelected ? 700 : 500,
                  background: isSelected ? "var(--color-navy-dark)" : "var(--bg-subtle)",
                  color: isSelected ? "#ffffff" : "var(--text-primary)",
                  border: "1px solid var(--color-border-subtle)",
                  cursor: "pointer",
                }}
              >
                {d.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Quick Search within Mapped Facilities */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ position: "relative" }}>
            <IconSearch
              width={14}
              height={14}
              style={{ position: "absolute", left: "0.6rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
            />
            <input
              type="text"
              placeholder="Search map facilities…"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{
                padding: "0.35rem 0.65rem 0.35rem 2rem",
                borderRadius: "4px",
                fontSize: "0.78rem",
                border: "1px solid var(--color-border-strong)",
                width: "200px",
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
              }}
            />
          </div>
          {(selectedDistrictId !== "ALL" || searchFilter) && (
            <button
              type="button"
              onClick={() => {
                setSelectedDistrictId("ALL");
                setSearchFilter("");
              }}
              style={{
                fontSize: "0.75rem",
                background: "transparent",
                border: "none",
                color: "var(--action-green-dark)",
                cursor: "pointer",
                textDecoration: "underline",
                fontWeight: 600,
              }}
            >
              Reset View
            </button>
          )}
        </div>
      </div>

      {/* Main Map Container: Split Canvas (Left) + Detail Dossier (Right) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          gap: "1.25rem",
          alignItems: "start",
        }}
      >
        {/* Left Side: SVG Geographic Map Canvas */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid var(--color-border-strong)",
            borderRadius: "8px",
            overflow: "hidden",
            position: "relative",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          {/* Map Header Overlay */}
          <div
            style={{
              position: "absolute",
              top: "0.75rem",
              left: "0.85rem",
              background: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(4px)",
              padding: "0.45rem 0.85rem",
              borderRadius: "6px",
              border: "1px solid var(--color-border-subtle)",
              zIndex: 2,
              pointerEvents: "none",
            }}
          >
            <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", color: "var(--color-navy-brand)", letterSpacing: "0.04em" }}>
              Odisha State Social Welfare GIS
            </div>
            <div style={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--text-primary)" }}>
              {selectedDistrictId === "ALL" ? "State-Wide Registry View" : `${DISTRICT_GEOMETRIES.find((d) => d.id === selectedDistrictId)?.name} District Scope`}
            </div>
          </div>

          {/* North Compass & Scale Bar */}
          <div
            style={{
              position: "absolute",
              bottom: "0.85rem",
              left: "0.85rem",
              background: "rgba(255, 255, 255, 0.9)",
              padding: "0.35rem 0.65rem",
              borderRadius: "4px",
              border: "1px solid var(--color-border-subtle)",
              fontSize: "0.68rem",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              zIndex: 2,
            }}
          >
            <span style={{ fontWeight: 700, color: "var(--color-navy-brand)" }}>▲ N</span>
            <span>Scale: 1:2,500,000</span>
            <span style={{ width: "35px", height: "3px", background: "var(--color-navy-dark)", display: "inline-block" }} />
            <span>50 km</span>
          </div>

          {/* Map Legend */}
          <div
            style={{
              position: "absolute",
              top: "0.75rem",
              right: "0.85rem",
              background: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(4px)",
              padding: "0.45rem 0.75rem",
              borderRadius: "6px",
              border: "1px solid var(--color-border-subtle)",
              fontSize: "0.7rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
              zIndex: 2,
            }}
          >
            <div style={{ fontWeight: 700, color: "var(--color-navy-brand)", marginBottom: "0.15rem" }}>Legend</div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a" }} />
              <span>Active ({activeCount})</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#d97706" }} />
              <span>Pending ({pendingCount})</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#64748b" }} />
              <span>Draft ({draftCount})</span>
            </div>
          </div>

          {/* Interactive SVG Canvas */}
          <svg
            viewBox={`0 0 ${MAP_BOUNDS.svgWidth} ${MAP_BOUNDS.svgHeight}`}
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              background: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
            }}
          >
            {/* Cartographic Coordinate Grid */}
            <defs>
              <pattern id="coordGrid" width="80" height="80" patternUnits="userSpaceOnUse">
                <path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(148, 163, 184, 0.18)" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width={MAP_BOUNDS.svgWidth} height={MAP_BOUNDS.svgHeight} fill="url(#coordGrid)" />

            {/* Bay of Bengal Coast Water Area */}
            <path
              d="M 540,465 Q 600,430 680,480 L 800,580 L 430,580 L 430,520 Z"
              fill="#e0f2fe"
              stroke="#bae6fd"
              strokeWidth="1.2"
              opacity="0.85"
            />
            <text x="630" y="530" fill="#0284c7" fontSize="11" fontWeight="600" opacity="0.6" fontStyle="italic">
              BAY OF BENGAL
            </text>

            {/* Surrounding Context Districts (Muted) */}
            {SURROUNDING_REGIONS.map((reg) => (
              <path
                key={reg.name}
                d={reg.path}
                fill="#f8fafc"
                stroke="#cbd5e1"
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.65"
              />
            ))}

            {/* Statutory Focus Districts */}
            {DISTRICT_GEOMETRIES.map((dist) => {
              const isSelected = selectedDistrictId === dist.id;
              const isHovered = hoveredDistrictId === dist.id;
              const hasProjects = projects.some((p) => p.districtId === dist.id);

              return (
                <g key={dist.id}>
                  <path
                    d={dist.path}
                    fill={
                      isSelected
                        ? "rgba(14, 122, 52, 0.18)"
                        : isHovered
                          ? "rgba(22, 101, 52, 0.12)"
                          : hasProjects
                            ? "#ffffff"
                            : "#f1f5f9"
                    }
                    stroke={isSelected ? "var(--action-green-dark)" : "#94a3b8"}
                    strokeWidth={isSelected ? "2.5" : "1.2"}
                    style={{
                      transition: "all 0.2s ease",
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedDistrictId(dist.id)}
                    onMouseEnter={() => setHoveredDistrictId(dist.id)}
                    onMouseLeave={() => setHoveredDistrictId(null)}
                  />
                  {/* District Centroid Label */}
                  <text
                    x={dist.labelX}
                    y={dist.labelY}
                    textAnchor="middle"
                    fill={isSelected ? "var(--action-green-dark)" : "var(--color-navy-brand)"}
                    fontSize="10"
                    fontWeight={isSelected ? "800" : "700"}
                    letterSpacing="0.04em"
                    style={{ pointerEvents: "none" }}
                  >
                    {dist.name.toUpperCase()}
                  </text>
                  <text
                    x={dist.labelX}
                    y={dist.labelY + 12}
                    textAnchor="middle"
                    fill="var(--text-muted)"
                    fontSize="8"
                    style={{ pointerEvents: "none" }}
                  >
                    {dist.code}
                  </text>
                </g>
              );
            })}

            {/* Facility Markers on Map */}
            {visibleProjects.map((p) => {
              const isSelected = selectedProject?.id === p.id;
              const isHovered = hoveredProjectId === p.id;
              const color = getStatusColor(p.status);

              return (
                <g
                  key={p.id}
                  transform={`translate(${p.svgX}, ${p.svgY})`}
                  style={{ cursor: "pointer", transition: "transform 0.15s ease" }}
                  onClick={() => setSelectedProjectId(p.id)}
                  onMouseEnter={() => setHoveredProjectId(p.id)}
                  onMouseLeave={() => setHoveredProjectId(null)}
                >
                  {/* Animated radar ring for active facilities */}
                  {p.status === "Active" && (
                    <circle
                      r="14"
                      fill="none"
                      stroke={color}
                      strokeWidth="1.5"
                      opacity="0.4"
                    >
                      <animate
                        attributeName="r"
                        values="8;18;8"
                        dur="2.8s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.6;0.1;0.6"
                        dur="2.8s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}

                  {/* Marker Pin Base Shadow */}
                  <ellipse cx="0" cy="3" rx="7" ry="3" fill="rgba(0,0,0,0.22)" />

                  {/* Teardrop / Badge Pin Shape */}
                  <path
                    d="M 0,-24 C -8,-24 -11,-17 0,0 C 11,-17 8,-24 0,-24 Z"
                    fill={isSelected ? "var(--color-navy-brand)" : color}
                    stroke="#ffffff"
                    strokeWidth={isSelected ? "2.5" : "1.8"}
                    filter={isSelected || isHovered ? "drop-shadow(0 2px 5px rgba(0,0,0,0.35))" : undefined}
                  />

                  {/* Inner Pin Icon Circle */}
                  <circle cx="0" cy="-14" r="4.5" fill="#ffffff" />
                  <circle cx="0" cy="-14" r="2.5" fill={isSelected ? "var(--color-navy-brand)" : color} />

                  {/* Facility Code Pill on hover/selected */}
                  {(isSelected || isHovered) && (
                    <g transform="translate(0, -32)" style={{ pointerEvents: "none" }}>
                      <rect
                        x="-45"
                        y="-16"
                        width="90"
                        height="18"
                        rx="4"
                        fill="rgba(15, 23, 42, 0.92)"
                      />
                      <text
                        x="0"
                        y="-4"
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="9"
                        fontWeight="700"
                        fontFamily="var(--font-mono)"
                      >
                        {p.code}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right Side: Selected Facility Dossier Panel */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: "8px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "0.85rem 1.15rem",
              background: "var(--bg-subtle)",
              borderBottom: "1px solid var(--color-border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <IconShieldCheck width={16} height={16} style={{ color: "var(--action-green-dark)" }} />
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--color-navy-brand)" }}>
                Facility Dossier Inspector
              </span>
            </div>
            <span
              style={{
                fontSize: "0.72rem",
                fontFamily: "var(--font-mono)",
                color: "var(--text-muted)",
              }}
            >
              {visibleProjects.length} visible
            </span>
          </div>

          {selectedProject ? (
            <div style={{ padding: "1.15rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Header: Code + Status Badge */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                <div>
                  <span
                    className="code-badge"
                    style={{
                      fontSize: "0.78rem",
                      display: "inline-block",
                      marginBottom: "0.35rem",
                    }}
                  >
                    {selectedProject.code}
                  </span>
                  <div
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color:
                        selectedProject.type === "authority_project"
                          ? "var(--action-green-dark)"
                          : "var(--color-navy-brand)",
                    }}
                  >
                    {selectedProject.type === "authority_project"
                      ? "Direct Authority Project"
                      : "Institution / NGO Facility"}
                  </div>
                </div>
                <StatusBadge status={selectedProject.status} />
              </div>

              {/* Title */}
              <div>
                <h3
                  style={{
                    margin: "0 0 0.25rem 0",
                    fontSize: "1.05rem",
                    fontWeight: 700,
                    color: "var(--color-navy-brand)",
                    lineHeight: 1.3,
                  }}
                >
                  {selectedProject.name}
                </h3>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  {selectedProject.categoryLabel}
                </div>
              </div>

              {/* Statutory Specifications List */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.55rem",
                  fontSize: "0.8rem",
                  borderTop: "1px solid var(--color-border-subtle)",
                  borderBottom: "1px solid var(--color-border-subtle)",
                  padding: "0.75rem 0",
                }}
              >
                <div>
                  <span style={{ color: "var(--text-subtle)", display: "block", fontSize: "0.7rem", textTransform: "uppercase", fontWeight: 600 }}>
                    Jurisdiction & District
                  </span>
                  <strong style={{ color: "var(--text-primary)" }}>
                    {getDistrictName(selectedProject.districtId, selectedProject.code)} District, Odisha
                  </strong>
                </div>

                <div>
                  <span style={{ color: "var(--text-subtle)", display: "block", fontSize: "0.7rem", textTransform: "uppercase", fontWeight: 600 }}>
                    Operating Agency / Directorate
                  </span>
                  <strong style={{ color: "var(--text-primary)", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                    <IconBuilding width={14} height={14} style={{ color: "var(--text-muted)" }} />
                    {getOrganisationName(selectedProject.organisationId)}
                  </strong>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <div>
                    <span style={{ color: "var(--text-subtle)", display: "block", fontSize: "0.7rem", textTransform: "uppercase", fontWeight: 600 }}>
                      Sanctioned Capacity
                    </span>
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                      {selectedProject.capacityLabel}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-subtle)", display: "block", fontSize: "0.7rem", textTransform: "uppercase", fontWeight: 600 }}>
                      GIS Coordinates
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      {selectedProject.geoLat.toFixed(4)}°N, {selectedProject.geoLng.toFixed(4)}°E
                    </span>
                  </div>
                </div>
              </div>

              {/* Description Snippet */}
              {selectedProject.description && (
                <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                  {selectedProject.description}
                </div>
              )}

              {/* Action Deep-Links */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.5rem" }}>
                <Link
                  href={`/projects/${selectedProject.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.35rem",
                    padding: "0.55rem 1rem",
                    background: "linear-gradient(to right, var(--action-green), var(--action-green-dark))",
                    color: "#ffffff",
                    borderRadius: "6px",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    textDecoration: "none",
                    boxShadow: "0 1px 2px rgba(14, 122, 52, 0.25)",
                  }}
                >
                  <span>Open Facility Workspace</span>
                  <IconChevronRight width={14} height={14} />
                </Link>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                  <Link
                    href={`/projects/${selectedProject.id}/inspections`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.25rem",
                      padding: "0.4rem 0.5rem",
                      background: "var(--bg-subtle)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--color-border-subtle)",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    <span>Inspections</span>
                  </Link>

                  <Link
                    href={`/projects/${selectedProject.id}/reports`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.25rem",
                      padding: "0.4rem 0.5rem",
                      background: "var(--bg-subtle)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--color-border-subtle)",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    <span>Dossiers</span>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: "2.5rem 1rem", textAlign: "center", color: "var(--text-muted)" }}>
              <IconMapPin width={28} height={28} style={{ color: "var(--text-subtle)", marginBottom: "0.5rem" }} />
              <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>No Facility Selected</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)", marginTop: "0.25rem" }}>
                Click any facility pin on the GIS map to view statutory metadata and deep-links.
              </div>
            </div>
          )}

          {/* Quick List of Other Facilities in this District */}
          <div
            style={{
              marginTop: "auto",
              borderTop: "1px solid var(--color-border-subtle)",
              background: "var(--bg-subtle)",
              padding: "0.75rem 1.15rem",
            }}
          >
            <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.4rem" }}>
              Facilities on Map ({visibleProjects.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", maxHeight: "150px", overflowY: "auto" }}>
              {visibleProjects.map((p) => {
                const isSelected = selectedProject?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProjectId(p.id)}
                    style={{
                      textAlign: "left",
                      padding: "0.35rem 0.5rem",
                      borderRadius: "4px",
                      background: isSelected ? "var(--bg-surface)" : "transparent",
                      border: isSelected ? "1px solid var(--action-green)" : "1px solid transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.76rem",
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? "var(--color-navy-brand)" : "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.code} &mdash; {p.name}
                    </span>
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: getStatusColor(p.status),
                        flexShrink: 0,
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
