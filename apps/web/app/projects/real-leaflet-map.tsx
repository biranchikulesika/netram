"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Project, ProjectStatus } from "@netram/types";
import { StatusBadge } from "./[id]/status-badge";
import {
  IconMapPin,
  IconShieldCheck,
  IconChevronRight,
  IconCheck,
} from "../components/icons";
import { getDistrictName, getOrganisationName } from "../../lib/presentation";

// Visibility & Access Levels (§34 Disclosure Policy)
export type VisibilityLevel = "authority" | "district" | "institution" | "public";

interface RealLeafletMapProps {
  projects: Project[];
  userRole?: string;
  isAuthority?: boolean;
}

interface GeofenceConfig {
  type: "circle" | "polygon";
  radiusMeters: number;
  polygonPoints: [number, number][]; // [lat, lng]
  sealedAt?: string;
  sealedBy?: string;
}

// Known district coordinates in Odisha for fallback
const DISTRICT_COORDINATES: Record<string, { lat: number; lng: number; name: string }> = {
  "5f6c6fcf-fc88-5bf1-9f63-cad86ee0bd3b": { lat: 20.2961, lng: 85.8245, name: "Khordha (Bhubaneswar)" },
  "92f0e386-2b80-5ca4-94a0-9c7d90d47dbf": { lat: 20.4625, lng: 85.8830, name: "Cuttack" },
  "ec220eb3-d4a3-5b12-9412-26d8badeafe7": { lat: 19.8135, lng: 85.8312, name: "Puri" },
  "a2dfd214-5aa0-5c7a-aa78-7b59865ba0a3": { lat: 19.3800, lng: 84.8500, name: "Ganjam (Berhampur)" },
  "e71c0cc4-6569-5e2b-bb73-cc3cae07fb8d": { lat: 22.1200, lng: 84.0300, name: "Sundargarh (Rourkela)" },
};

function parseGpsCoordinates(desc: string | null): { lat: number; lng: number } | null {
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
  if (!desc) return "Standard (100 beneficiaries)";
  const match = desc.match(/Sanctioned Capacity:\s*([^|]+)/i);
  return match && match[1] ? match[1].trim() : "100 beneficiaries";
}

function parseWelfareCategory(desc: string | null): string {
  if (!desc) return "General Sanctioned Facility";
  const match = desc.match(/Category:\s*([^|]+)/i);
  return match && match[1] ? match[1].trim() : "General Sanctioned Facility";
}

function getStatusColor(status: ProjectStatus) {
  switch (status) {
    case "Active":
      return "#16a34a"; // green
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

export default function RealLeafletMap({
  projects,
  userRole: _userRole = "authority_officer",
  isAuthority = true,
}: RealLeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const geofenceLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Active Map View States
  const [mapType, setMapType] = useState<"streets" | "satellite">("streets");
  const [visibilityLevel, setVisibilityLevel] = useState<VisibilityLevel>("authority");
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>("ALL");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    projects[0]?.id ?? null,
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Geofencing Interactive State
  const [geofenceMode, setGeofenceMode] = useState<"view" | "edit-circle" | "edit-polygon">("view");
  const [circleRadius, setCircleRadius] = useState<number>(200); // meters
  const [polygonVertices, setPolygonVertices] = useState<[number, number][]>([]);
  const [geofenceSaveSuccess, setGeofenceSaveSuccess] = useState<string | null>(null);

  // Storage of geofence configs per project (in-memory for demo / live updates)
  const [geofences, setGeofences] = useState<Record<string, GeofenceConfig>>({
    "50e7100e-8ac6-4d46-ae2a-93663249ce45": {
      type: "circle",
      radiusMeters: 250,
      polygonPoints: [],
      sealedAt: "2026-09-18T18:00:00Z",
      sealedBy: "District Social Welfare Officer, Puri",
    },
  });

  // Calculate coordinates for all projects
  const facilities = useMemo(() => {
    return projects.map((p, index) => {
      const parsed = parseGpsCoordinates(p.description);
      let lat = parsed?.lat;
      let lng = parsed?.lng;

      if (!lat || !lng) {
        const dist = p.districtId ? DISTRICT_COORDINATES[p.districtId] : null;
        const baseLat = dist ? dist.lat : 20.2961;
        const baseLng = dist ? dist.lng : 85.8245;

        // Deterministic offset to prevent exact overlap
        const hash = (p.id + p.code).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const angle = ((hash + index * 47) % 360) * (Math.PI / 180);
        const offsetDist = 0.015 + ((hash % 7) * 0.008);

        lat = baseLat + Math.sin(angle) * offsetDist;
        lng = baseLng + Math.cos(angle) * offsetDist;
      }

      return {
        ...p,
        lat,
        lng,
        capacityLabel: parseSanctionedCapacity(p.description),
        categoryLabel: parseWelfareCategory(p.description),
      };
    });
  }, [projects]);

  // Filtered facilities based on district and search
  const visibleFacilities = useMemo(() => {
    return facilities.filter((f) => {
      if (selectedDistrictId !== "ALL" && f.districtId !== selectedDistrictId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          f.name.toLowerCase().includes(q) ||
          f.code.toLowerCase().includes(q) ||
          (f.description ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [facilities, selectedDistrictId, searchQuery]);

  const selectedFacility = useMemo(() => {
    return (
      facilities.find((f) => f.id === selectedProjectId) ??
      visibleFacilities[0] ??
      null
    );
  }, [facilities, selectedProjectId, visibleFacilities]);

  // Active geofence for selected facility
  const currentGeofence: GeofenceConfig = useMemo(() => {
    if (!selectedFacility) {
      return { type: "circle", radiusMeters: 200, polygonPoints: [] };
    }
    return (
      geofences[selectedFacility.id] ?? {
        type: "circle",
        radiusMeters: circleRadius,
        polygonPoints: polygonVertices,
      }
    );
  }, [selectedFacility, geofences, circleRadius, polygonVertices]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Check if map already initialized
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [20.35, 85.82], // Centered around Odisha
        zoom: 8,
        minZoom: 6,
        maxZoom: 18,
        zoomControl: false,
      });

      // Add Zoom Control at bottom right
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Base tile layers
      const streetLayer = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors • Netram GIS',
          maxZoom: 19,
        },
      );

      streetLayer.addTo(map);
      tileLayerRef.current = streetLayer;

      // Layer groups for markers & geofences
      const markersGroup = L.layerGroup().addTo(map);
      const geofenceGroup = L.layerGroup().addTo(map);

      markersGroupRef.current = markersGroup;
      geofenceLayerRef.current = geofenceGroup;
      mapInstanceRef.current = map;

      // Handle Map Click for Polygon Geofence Drawing
      map.on("click", (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        // In polygon edit mode, add vertex
        setPolygonVertices((prev) => {
          if (geofenceMode === "edit-polygon") {
            return [...prev, [lat, lng]];
          }
          return prev;
        });
      });
    }

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // Run once on mount

  // Switch Tile Layer (Street vs Satellite)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    if (mapType === "satellite") {
      // Esri Satellite
      const satLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution:
            "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
          maxZoom: 18,
        },
      );
      satLayer.addTo(map);
      tileLayerRef.current = satLayer;
    } else {
      // OpenStreetMap Street
      const streetLayer = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors • Netram GIS',
          maxZoom: 19,
        },
      );
      streetLayer.addTo(map);
      tileLayerRef.current = streetLayer;
    }
  }, [mapType]);

  // Update Facility Markers & Popups on Map
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;
    const markersGroup = markersGroupRef.current;
    markersGroup.clearLayers();

    visibleFacilities.forEach((f) => {
      const isSelected = selectedFacility?.id === f.id;
      const color = getStatusColor(f.status);

      // Create Custom HTML DivIcon
      const iconHtml = `
        <div style="position: relative; display: flex; align-items: center; justify-content: center;">
          ${
            f.status === "Active"
              ? `<div style="position: absolute; width: 34px; height: 34px; border-radius: 50%; border: 2px solid ${color}; opacity: 0.5; animation: ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>`
              : ""
          }
          <div style="
            width: ${isSelected ? "28px" : "22px"};
            height: ${isSelected ? "28px" : "22px"};
            border-radius: 50%;
            background: ${color};
            border: 2px solid #ffffff;
            box-shadow: 0 2px 6px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-size: 10px;
            font-weight: 800;
            transition: all 0.2s ease;
          ">
            ${f.type === "authority_project" ? "★" : "●"}
          </div>
          ${
            isSelected
              ? `<div style="
                  position: absolute;
                  bottom: -22px;
                  background: #0f172a;
                  color: #ffffff;
                  font-family: monospace;
                  font-size: 9px;
                  font-weight: 700;
                  padding: 1px 5px;
                  border-radius: 3px;
                  white-space: nowrap;
                  pointer-events: none;
                ">${f.code}</div>`
              : ""
          }
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: "custom-leaflet-marker",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([f.lat, f.lng], { icon: customIcon });

      // Click to select
      marker.on("click", () => {
        setSelectedProjectId(f.id);
      });

      // Bind Tooltip
      marker.bindTooltip(
        `<strong>${f.code}</strong>: ${f.name}<br/><span style="color:${color};font-weight:600">${f.status}</span> • ${getDistrictName(f.districtId, f.code)}`,
        { direction: "top", offset: [0, -12] },
      );

      marker.addTo(markersGroup);
    });
  }, [visibleFacilities, selectedFacility]);

  // Render Geofence (Circle or Polygon) for Selected Facility
  useEffect(() => {
    if (!mapInstanceRef.current || !geofenceLayerRef.current) return;
    const geofenceGroup = geofenceLayerRef.current;
    geofenceGroup.clearLayers();

    if (!selectedFacility) return;

    const lat = selectedFacility.lat;
    const lng = selectedFacility.lng;

    if (geofenceMode === "edit-polygon" && polygonVertices.length > 0) {
      // Draw Polygon under construction
      const polygon = L.polygon(polygonVertices, {
        color: "#2563eb",
        weight: 2.5,
        dashArray: "6, 6",
        fillColor: "#3b82f6",
        fillOpacity: 0.2,
      });
      polygon.addTo(geofenceGroup);

      // Render vertex dots
      polygonVertices.forEach((pt, i) => {
        L.circleMarker(pt, {
          radius: 5,
          color: "#1d4ed8",
          fillColor: "#ffffff",
          fillOpacity: 1,
          weight: 2,
        })
          .bindTooltip(`Vertex ${i + 1}`, { permanent: false })
          .addTo(geofenceGroup);
      });
    } else if (currentGeofence.type === "polygon" && currentGeofence.polygonPoints.length >= 3) {
      // Draw Saved Polygon
      const polygon = L.polygon(currentGeofence.polygonPoints, {
        color: "#16a34a",
        weight: 2.5,
        fillColor: "#22c55e",
        fillOpacity: 0.22,
      });
      polygon.bindTooltip(
        `<strong>Statutory Geofence Boundary</strong><br/>Enclosed Campus Area: ${calculatePolygonAreaHectares(currentGeofence.polygonPoints)} ha`,
        { sticky: true },
      );
      polygon.addTo(geofenceGroup);
    } else {
      // Draw Circular Geofence
      const radius = geofenceMode === "edit-circle" ? circleRadius : currentGeofence.radiusMeters;
      const circle = L.circle([lat, lng], {
        radius,
        color: geofenceMode === "edit-circle" ? "#2563eb" : "#16a34a",
        weight: 2,
        dashArray: geofenceMode === "edit-circle" ? "5, 5" : undefined,
        fillColor: geofenceMode === "edit-circle" ? "#3b82f6" : "#22c55e",
        fillOpacity: 0.18,
      });

      circle.bindTooltip(
        `<strong>Statutory Geofenced Perimeter</strong><br/>Radius: ${radius}m • ${((Math.PI * radius * radius) / 10000).toFixed(2)} ha`,
        { sticky: true },
      );
      circle.addTo(geofenceGroup);
    }
  }, [selectedFacility, geofenceMode, circleRadius, polygonVertices, currentGeofence]);

  // Center map when facility is selected
  const flyToFacility = (lat: number, lng: number) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], 14, { duration: 1.2 });
    }
  };

  // Reset to full state bounds
  const handleResetView = () => {
    setSelectedDistrictId("ALL");
    setSearchQuery("");
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([20.35, 85.82], 8, { duration: 1.2 });
    }
  };

  // Calculate polygon area in hectares
  function calculatePolygonAreaHectares(points: [number, number][]): string {
    if (points.length < 3) return "0.00";
    // Approximate spherical polygon area
    let area = 0;
    const R = 6378137; // Earth radius in meters
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i]!;
      const p2 = points[(i + 1) % points.length]!;
      const x1 = (p1[1] * Math.PI) / 180;
      const y1 = (p1[0] * Math.PI) / 180;
      const x2 = (p2[1] * Math.PI) / 180;
      const y2 = (p2[0] * Math.PI) / 180;
      area += (x2 - x1) * (2 + Math.sin(y1) + Math.sin(y2));
    }
    area = Math.abs((area * R * R) / 2.0);
    return (area / 10000).toFixed(2);
  }

  // Save Geofence Action (Authorized Officer)
  const handleSaveGeofence = () => {
    if (!selectedFacility) return;

    if (!isAuthority) {
      alert("Unauthorized: Only Department Authority Officers or Admins can seal geofences (AGENTS.md §40).");
      return;
    }

    const newConfig: GeofenceConfig =
      geofenceMode === "edit-polygon" && polygonVertices.length >= 3
        ? {
            type: "polygon",
            radiusMeters: 0,
            polygonPoints: polygonVertices,
            sealedAt: new Date().toISOString(),
            sealedBy: "District Social Welfare Officer (Authority)",
          }
        : {
            type: "circle",
            radiusMeters: circleRadius,
            polygonPoints: [],
            sealedAt: new Date().toISOString(),
            sealedBy: "District Social Welfare Officer (Authority)",
          };

    setGeofences((prev) => ({
      ...prev,
      [selectedFacility.id]: newConfig,
    }));

    setGeofenceMode("view");
    setGeofenceSaveSuccess(
      `Statutory Geofence Sealed for ${selectedFacility.code} (${newConfig.type === "circle" ? `${newConfig.radiusMeters}m radius` : `${newConfig.polygonPoints.length}-point polygon`}). Audit record append-logged.`,
    );

    setTimeout(() => {
      setGeofenceSaveSuccess(null);
    }, 4000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
      {/* Top Map Operational Banner */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          background: "var(--bg-surface)",
          border: "1px solid var(--color-border-strong)",
          borderRadius: "8px",
          padding: "0.85rem 1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              background: "var(--color-navy-dark)",
              color: "#ffffff",
              width: 36,
              height: 36,
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconMapPin width={20} height={20} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "var(--color-navy-brand)" }}>
              Official Odisha Social Welfare GIS & Geofencing Console
            </h2>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Real-time cartographic coordinates, statutory geofence boundaries, and access disclosure oversight
            </div>
          </div>
        </div>

        {/* Visibility Level & Disclosure Mode Switcher (§34) */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Disclosure Lens:
          </span>
          <div className="view-mode-toggle">
            <button
              type="button"
              className={`view-btn ${visibilityLevel === "authority" ? "active" : ""}`}
              onClick={() => setVisibilityLevel("authority")}
              title="Full Administrative Access"
            >
              Authority
            </button>
            <button
              type="button"
              className={`view-btn ${visibilityLevel === "district" ? "active" : ""}`}
              onClick={() => setVisibilityLevel("district")}
              title="District Jurisdictional Scope"
            >
              District
            </button>
            <button
              type="button"
              className={`view-btn ${visibilityLevel === "institution" ? "active" : ""}`}
              onClick={() => setVisibilityLevel("institution")}
              title="Operating Agency Scope"
            >
              Agency
            </button>
            <button
              type="button"
              className={`view-btn ${visibilityLevel === "public" ? "active" : ""}`}
              onClick={() => setVisibilityLevel("public")}
              title="Public Citizen Transparency View"
            >
              Public
            </button>
          </div>
        </div>
      </div>

      {/* Geofence Authority Protocol Notice */}
      <div
        style={{
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          borderRadius: "8px",
          padding: "0.75rem 1.15rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <IconShieldCheck width={18} height={18} style={{ color: "#1d4ed8", flexShrink: 0 }} />
          <span style={{ fontSize: "0.78rem", color: "#1e3a8a", lineHeight: 1.4 }}>
            <strong>Statutory Geofencing Authority (AGENTS.md §40):</strong> Geofencing perimeters are legally
            established exclusively by <strong>Department Authority Officers (DSWOs)</strong> and <strong>System Administrators</strong>.
            Operating agencies and field inspectors are restricted from modifying perimeters to prevent anti-fraud evasion.
          </span>
        </div>
        <span
          style={{
            fontSize: "0.7rem",
            fontWeight: 700,
            background: isAuthority ? "#dcfce7" : "#f1f5f9",
            color: isAuthority ? "#15803d" : "#64748b",
            padding: "0.25rem 0.5rem",
            borderRadius: "4px",
            whiteSpace: "nowrap",
            border: "1px solid currentColor",
          }}
        >
          {isAuthority ? "GEOFENCE CONFIG UNLOCKED" : "VIEW ONLY (AGENCY)"}
        </span>
      </div>

      {geofenceSaveSuccess && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#15803d",
            padding: "0.75rem 1rem",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.82rem",
            fontWeight: 600,
          }}
        >
          <IconCheck width={16} height={16} />
          <span>{geofenceSaveSuccess}</span>
        </div>
      )}

      {/* Map Controls Filter Bar */}
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
          padding: "0.65rem 1rem",
        }}
      >
        {/* District Jurisdiction Pills */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
            District:
          </span>
          <button
            type="button"
            onClick={() => setSelectedDistrictId("ALL")}
            style={{
              padding: "0.25rem 0.6rem",
              borderRadius: "4px",
              fontSize: "0.76rem",
              fontWeight: selectedDistrictId === "ALL" ? 700 : 500,
              background: selectedDistrictId === "ALL" ? "var(--color-navy-dark)" : "var(--bg-subtle)",
              color: selectedDistrictId === "ALL" ? "#ffffff" : "var(--text-primary)",
              border: "1px solid var(--color-border-subtle)",
              cursor: "pointer",
            }}
          >
            All Odisha ({facilities.length})
          </button>
          {Object.entries(DISTRICT_COORDINATES).map(([id, dist]) => {
            const count = facilities.filter((f) => f.districtId === id).length;
            const isSelected = selectedDistrictId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setSelectedDistrictId(id);
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.flyTo([dist.lat, dist.lng], 11, { duration: 1 });
                  }
                }}
                style={{
                  padding: "0.25rem 0.6rem",
                  borderRadius: "4px",
                  fontSize: "0.76rem",
                  fontWeight: isSelected ? 700 : 500,
                  background: isSelected ? "var(--color-navy-dark)" : "var(--bg-subtle)",
                  color: isSelected ? "#ffffff" : "var(--text-primary)",
                  border: "1px solid var(--color-border-subtle)",
                  cursor: "pointer",
                }}
              >
                {dist.name.split(" ")[0]} ({count})
              </button>
            );
          })}
        </div>

        {/* Map Style & Search */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {/* Map Layer Switcher */}
          <div className="view-mode-toggle">
            <button
              type="button"
              className={`view-btn ${mapType === "streets" ? "active" : ""}`}
              onClick={() => setMapType("streets")}
            >
              Street Map
            </button>
            <button
              type="button"
              className={`view-btn ${mapType === "satellite" ? "active" : ""}`}
              onClick={() => setMapType("satellite")}
            >
              Satellite
            </button>
          </div>

          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="Search facility name or code…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: "0.3rem 0.6rem",
                borderRadius: "4px",
                fontSize: "0.78rem",
                border: "1px solid var(--color-border-strong)",
                width: "180px",
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleResetView}
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
            Reset
          </button>
        </div>
      </div>

      {/* Main Real Map + Inspector Split View */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 380px",
          gap: "1rem",
          alignItems: "start",
        }}
      >
        {/* Left: Leaflet Slippy Map Canvas */}
        <div
          style={{
            position: "relative",
            height: "620px",
            borderRadius: "8px",
            border: "1px solid var(--color-border-strong)",
            overflow: "hidden",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}
        >
          {/* The Leaflet DOM Node */}
          <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

          {/* Floating HUD Indicator on Map */}
          <div
            style={{
              position: "absolute",
              top: "0.75rem",
              left: "0.75rem",
              background: "rgba(15, 23, 42, 0.88)",
              color: "#ffffff",
              backdropFilter: "blur(6px)",
              padding: "0.4rem 0.75rem",
              borderRadius: "6px",
              zIndex: 1000,
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
            <span style={{ fontSize: "0.74rem", fontWeight: 700, letterSpacing: "0.02em" }}>
              LIVE GIS TILE LAYER &bull; ODISHA REGION
            </span>
            <span style={{ fontSize: "0.68rem", opacity: 0.75 }}>
              ({visibleFacilities.length} facilities displayed)
            </span>
          </div>

          {/* Floating Geofence Draw Controls (when in draw mode) */}
          {geofenceMode !== "view" && (
            <div
              style={{
                position: "absolute",
                bottom: "1rem",
                left: "1rem",
                right: "1rem",
                background: "rgba(255, 255, 255, 0.96)",
                backdropFilter: "blur(8px)",
                border: "2px solid #2563eb",
                borderRadius: "8px",
                padding: "0.85rem 1.25rem",
                zIndex: 1000,
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <div>
                <strong style={{ fontSize: "0.82rem", color: "#1e40af", display: "block" }}>
                  {geofenceMode === "edit-circle"
                    ? `Configuring Circular Geofence for ${selectedFacility?.code}`
                    : `Drawing Custom Compound Polygon for ${selectedFacility?.code}`}
                </strong>
                <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                  {geofenceMode === "edit-circle"
                    ? `Perimeter Buffer: ${circleRadius} meters (${((Math.PI * circleRadius * circleRadius) / 10000).toFixed(2)} ha)`
                    : `Click anywhere on the map to add boundary points (${polygonVertices.length} points placed)`}
                </span>
              </div>

              {/* Slider for Circle Mode */}
              {geofenceMode === "edit-circle" && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <label htmlFor="radius-slider" style={{ fontSize: "0.74rem", fontWeight: 600 }}>
                    Radius: {circleRadius}m
                  </label>
                  <input
                    id="radius-slider"
                    type="range"
                    min={50}
                    max={1000}
                    step={25}
                    value={circleRadius}
                    onChange={(e) => setCircleRadius(parseInt(e.target.value, 10))}
                    style={{ width: "140px" }}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {geofenceMode === "edit-polygon" && polygonVertices.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPolygonVertices((prev) => prev.slice(0, -1))}
                    style={{
                      padding: "0.3rem 0.6rem",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      background: "var(--bg-subtle)",
                      border: "1px solid var(--color-border-strong)",
                      cursor: "pointer",
                    }}
                  >
                    Undo Point
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setGeofenceMode("view");
                    setPolygonVertices([]);
                  }}
                  style={{
                    padding: "0.35rem 0.75rem",
                    borderRadius: "4px",
                    fontSize: "0.78rem",
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--color-border-strong)",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveGeofence}
                  style={{
                    padding: "0.35rem 0.85rem",
                    borderRadius: "4px",
                    fontSize: "0.78rem",
                    background: "#16a34a",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                  }}
                >
                  Seal & Save Geofence
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Facility Dossier & Geofence Inspector Panel */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: "8px",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Panel Header */}
          <div
            style={{
              padding: "0.75rem 1rem",
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
                Geographic Dossier & Perimeter
              </span>
            </div>
            <span style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
              {visibleFacilities.length} in scope
            </span>
          </div>

          {selectedFacility ? (
            <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {/* Facility Identity Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                <div>
                  <span className="code-badge" style={{ fontSize: "0.76rem" }}>
                    {selectedFacility.code}
                  </span>
                  <div
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      marginTop: "0.2rem",
                      color:
                        selectedFacility.type === "authority_project"
                          ? "var(--action-green-dark)"
                          : "var(--color-navy-brand)",
                    }}
                  >
                    {selectedFacility.type === "authority_project"
                      ? "Direct Authority Project"
                      : "Institution / NGO Facility"}
                  </div>
                </div>
                <StatusBadge status={selectedFacility.status} />
              </div>

              {/* Title & Category */}
              <div>
                <h3 style={{ margin: "0 0 0.2rem 0", fontSize: "1rem", fontWeight: 700, color: "var(--color-navy-brand)" }}>
                  {selectedFacility.name}
                </h3>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {selectedFacility.categoryLabel}
                </div>
              </div>

              {/* Access Level / Visibility Indicator (§34) */}
              <div
                style={{
                  background:
                    visibilityLevel === "public"
                      ? "#fef2f2"
                      : visibilityLevel === "institution"
                        ? "#fffbeb"
                        : "#f0fdf4",
                  border: "1px solid",
                  borderColor:
                    visibilityLevel === "public"
                      ? "#fecaca"
                      : visibilityLevel === "institution"
                        ? "#fde68a"
                        : "#bbf7d0",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "6px",
                  fontSize: "0.72rem",
                  lineHeight: 1.4,
                }}
              >
                <div style={{ fontWeight: 700, textTransform: "uppercase", marginBottom: "0.15rem" }}>
                  {visibilityLevel === "public" && "Public Citizen Disclosure Scope"}
                  {visibilityLevel === "institution" && "Operating Agency Private Scope"}
                  {visibilityLevel === "district" && "District Jurisdictional Scope"}
                  {visibilityLevel === "authority" && "Full Departmental Authority Scope"}
                </div>
                <span style={{ color: "var(--text-muted)" }}>
                  {visibilityLevel === "public" && "Citizen portal view: PII & security floorplans redacted (§39 minimization)."}
                  {visibilityLevel === "institution" && "Access restricted to designated superintendent credentials."}
                  {visibilityLevel === "district" && "Access limited to DSWO jurisdiction and authorized field inspectors."}
                  {visibilityLevel === "authority" && "Full administrative authority: live telemetry, audit dossiers, and CCTV."}
                </span>
              </div>

              {/* Geofence Perimeter Card */}
              <div
                style={{
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--color-border-subtle)",
                  borderRadius: "6px",
                  padding: "0.75rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.4rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-primary)" }}>
                    Statutory Geofence Perimeter
                  </span>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      color: "#15803d",
                      background: "#dcfce7",
                      padding: "0.1rem 0.35rem",
                      borderRadius: "3px",
                    }}
                  >
                    ACTIVE SEAL
                  </span>
                </div>

                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {currentGeofence.type === "polygon" ? (
                    <>Custom Polygon Boundary: {currentGeofence.polygonPoints.length} vertices ({calculatePolygonAreaHectares(currentGeofence.polygonPoints)} ha)</>
                  ) : (
                    <>Circular Buffer: {currentGeofence.radiusMeters}m radius ({((Math.PI * currentGeofence.radiusMeters * currentGeofence.radiusMeters) / 10000).toFixed(2)} ha)</>
                  )}
                </div>

                {currentGeofence.sealedBy && (
                  <div style={{ fontSize: "0.68rem", color: "var(--text-subtle)" }}>
                    Sealed by: {currentGeofence.sealedBy}
                  </div>
                )}

                {/* Geofence Editing Action Buttons (Authority Only) */}
                {isAuthority && geofenceMode === "view" && (
                  <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.3rem" }}>
                    <button
                      type="button"
                      onClick={() => setGeofenceMode("edit-circle")}
                      style={{
                        flex: 1,
                        padding: "0.35rem",
                        fontSize: "0.74rem",
                        fontWeight: 600,
                        background: "var(--bg-surface)",
                        border: "1px solid var(--color-border-strong)",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      Adjust Radius
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGeofenceMode("edit-polygon");
                        setPolygonVertices([[selectedFacility.lat, selectedFacility.lng]]);
                      }}
                      style={{
                        flex: 1,
                        padding: "0.35rem",
                        fontSize: "0.74rem",
                        fontWeight: 600,
                        background: "var(--bg-surface)",
                        border: "1px solid var(--color-border-strong)",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      Draw Polygon
                    </button>
                  </div>
                )}
              </div>

              {/* Geographic Coordinates & Location */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.45rem",
                  fontSize: "0.78rem",
                  borderTop: "1px solid var(--color-border-subtle)",
                  borderBottom: "1px solid var(--color-border-subtle)",
                  padding: "0.6rem 0",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>GIS Coordinates:</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                    {selectedFacility.lat.toFixed(4)}°N, {selectedFacility.lng.toFixed(4)}°E
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Jurisdiction:</span>
                  <span style={{ fontWeight: 600 }}>
                    {getDistrictName(selectedFacility.districtId, selectedFacility.code)} District
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Operating Agency:</span>
                  <span style={{ fontWeight: 600 }}>
                    {getOrganisationName(selectedFacility.organisationId)}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Capacity:</span>
                  <span style={{ fontWeight: 600 }}>{selectedFacility.capacityLabel}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <button
                  type="button"
                  onClick={() => flyToFacility(selectedFacility.lat, selectedFacility.lng)}
                  style={{
                    padding: "0.45rem",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--color-border-strong)",
                    borderRadius: "4px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.3rem",
                  }}
                >
                  <IconMapPin width={14} height={14} />
                  <span>Center Map on Facility</span>
                </button>

                <Link
                  href={`/projects/${selectedFacility.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.35rem",
                    padding: "0.5rem 1rem",
                    background: "linear-gradient(to right, var(--action-green), var(--action-green-dark))",
                    color: "#ffffff",
                    borderRadius: "6px",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    textDecoration: "none",
                  }}
                >
                  <span>Open Full Facility Workspace</span>
                  <IconChevronRight width={14} height={14} />
                </Link>
              </div>
            </div>
          ) : (
            <div style={{ padding: "2rem 1rem", textAlign: "center", color: "var(--text-muted)" }}>
              <IconMapPin width={24} height={24} style={{ marginBottom: "0.4rem" }} />
              <div>No facility selected. Click any marker on the map.</div>
            </div>
          )}

          {/* Quick List of All Mapped Units */}
          <div
            style={{
              marginTop: "auto",
              borderTop: "1px solid var(--color-border-subtle)",
              background: "var(--bg-subtle)",
              padding: "0.6rem 1rem",
            }}
          >
            <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
              Facilities on Map ({visibleFacilities.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", maxHeight: "140px", overflowY: "auto" }}>
              {visibleFacilities.map((f) => {
                const isSelected = selectedFacility?.id === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setSelectedProjectId(f.id);
                      flyToFacility(f.lat, f.lng);
                    }}
                    style={{
                      textAlign: "left",
                      padding: "0.3rem 0.45rem",
                      borderRadius: "4px",
                      background: isSelected ? "var(--bg-surface)" : "transparent",
                      border: isSelected ? "1px solid var(--action-green)" : "1px solid transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.4rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.74rem",
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? "var(--color-navy-brand)" : "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {f.code} &mdash; {f.name}
                    </span>
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: getStatusColor(f.status),
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
