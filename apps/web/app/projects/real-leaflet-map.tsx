"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Project, ProjectStatus } from "@netram/types";
import { StatusBadge } from "./[id]/status-badge";
import {
  IconMapPin,
  IconShieldCheck,
  IconChevronRight,
  IconCheck,
  IconLock,
  IconBuilding,
} from "../components/icons";
import { getDistrictName, getOrganisationName } from "../../lib/presentation";

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
  auditTx?: string;
}

// Canonical District Coordinates in Odisha
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
  if (!desc) return "100 beneficiaries";
  const match = desc.match(/Sanctioned Capacity:\s*([^|]+)/i);
  return match && match[1] ? match[1].trim() : "100 beneficiaries";
}

function parseWelfareCategory(desc: string | null): string {
  if (!desc) return "General Welfare Facility";
  const match = desc.match(/Category:\s*([^|]+)/i);
  return match && match[1] ? match[1].trim() : "General Welfare Facility";
}

function getStatusColor(status: ProjectStatus): string {
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

  // Cartographic Controls
  const [mapType, setMapType] = useState<"streets" | "satellite">("streets");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    projects[0]?.id ?? null,
  );
  // Default drawer closed so user sees the complete, unobstructed map view
  const [showDrawer, setShowDrawer] = useState<boolean>(false);

  // Geofencing Interactive State
  const [geofenceMode, setGeofenceMode] = useState<"view" | "circle" | "polygon">("view");
  const [circleRadius, setCircleRadius] = useState<number>(250); // meters
  const [polygonVertices, setPolygonVertices] = useState<[number, number][]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Ref to always provide latest geofenceMode inside Leaflet map event callbacks
  const geofenceModeRef = useRef<"view" | "circle" | "polygon">(geofenceMode);
  useEffect(() => {
    geofenceModeRef.current = geofenceMode;
    if (mapContainerRef.current) {
      mapContainerRef.current.style.cursor = geofenceMode === "polygon" ? "crosshair" : "";
    }
  }, [geofenceMode]);

  const STORAGE_KEY = "netram_geofences_registry";

  // Persistent Geofences Registry (Per facility, synced to localStorage)
  const [geofences, setGeofences] = useState<Record<string, GeofenceConfig>>(() => {
    const defaultGeofences: Record<string, GeofenceConfig> = {
      "50e7100e-8ac6-4d46-ae2a-93663249ce45": {
        type: "circle",
        radiusMeters: 300,
        polygonPoints: [],
        sealedAt: "2026-09-18T10:30:00Z",
        sealedBy: "DSWO Puri",
        auditTx: "0x8f2d...41a9",
      },
    };

    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("netram_geofences_registry");
        if (stored) {
          return { ...defaultGeofences, ...JSON.parse(stored) };
        }
      } catch {
        // Fallback to default
      }
    }
    return defaultGeofences;
  });

  // Fetch authoritative geofences from Netram backend on mount
  useEffect(() => {
    let cancelled = false;
    async function loadServerGeofences() {
      try {
        const res = await fetch("/api/projects/geofences");
        if (!res.ok) return;
        const list = await res.json();
        if (Array.isArray(list) && !cancelled) {
          setGeofences((prev) => {
            const merged = { ...prev };
            for (const g of list) {
              if (g && g.projectId) {
                merged[g.projectId] = {
                  type: g.type,
                  radiusMeters: g.radiusMeters,
                  polygonPoints: Array.isArray(g.polygonVertices) ? g.polygonVertices : [],
                  sealedAt: g.sealedAt,
                  sealedBy: "DSWO",
                  auditTx: g.auditTx ?? undefined,
                };
              }
            }
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
              } catch {
                // Ignore
              }
            }
            return merged;
          });
        }
      } catch {
        // Fallback to local storage silently if network unavailable
      }
    }
    void loadServerGeofences();
    return () => {
      cancelled = true;
    };
  }, []);

  // Calculate project coordinates with deterministic spread for co-located institutions
  const facilities = useMemo(() => {
    return projects.map((p, index) => {
      const parsed = parseGpsCoordinates(p.description);
      let lat = parsed?.lat;
      let lng = parsed?.lng;

      if (!lat || !lng) {
        const dist = p.districtId ? DISTRICT_COORDINATES[p.districtId] : null;
        const baseLat = dist ? dist.lat : 20.2961;
        const baseLng = dist ? dist.lng : 85.8245;

        // Deterministic offset to prevent marker overlapping
        const hash = (p.id + p.code).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const angle = ((hash + index * 47) % 360) * (Math.PI / 180);
        const offsetDist = 0.012 + ((hash % 7) * 0.005);

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

  const visibleFacilities = facilities;

  const selectedFacility = useMemo(() => {
    return (
      facilities.find((f) => f.id === selectedProjectId) ??
      facilities[0] ??
      null
    );
  }, [facilities, selectedProjectId]);

  const currentGeofence: GeofenceConfig = useMemo(() => {
    if (!selectedFacility) {
      return { type: "circle", radiusMeters: 250, polygonPoints: [] };
    }
    return (
      geofences[selectedFacility.id] ?? {
        type: "circle",
        radiusMeters: 250,
        polygonPoints: [],
        sealedAt: "Pending",
        sealedBy: "DSWO",
      }
    );
  }, [selectedFacility, geofences]);

  // Zoom to fit all facilities on the map
  const fitAllFacilities = useCallback(() => {
    if (!mapInstanceRef.current || facilities.length === 0) return;
    const coords = facilities
      .filter((f) => f.lat && f.lng)
      .map((f) => [f.lat, f.lng] as [number, number]);

    if (coords.length > 0) {
      const bounds = L.latLngBounds(coords);
      mapInstanceRef.current.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 13,
      });
    } else {
      mapInstanceRef.current.setView([20.4, 84.8], 7);
    }
  }, [facilities]);

  const flyToFacility = useCallback((lat: number, lng: number) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], 15, { duration: 1.2 });
    }
  }, []);

  // Expose helper on window for popup button interactions
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__netram_open_dossier = (id: string) => {
      setSelectedProjectId(id);
      setShowDrawer(true);
    };
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__netram_open_dossier;
    };
  }, []);

  // Invalidate map size when drawer toggles to avoid tile clipping
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [showDrawer]);

  // Listen for window resize
  useEffect(() => {
    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [20.4, 84.8],
        zoom: 7,
        minZoom: 6,
        maxZoom: 18,
        zoomControl: false,
        scrollWheelZoom: true,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      const streetLayer = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
          keepBuffer: 4,
        },
      );
      streetLayer.addTo(map);
      tileLayerRef.current = streetLayer;

      const markersGroup = L.layerGroup().addTo(map);
      const geofenceGroup = L.layerGroup().addTo(map);

      markersGroupRef.current = markersGroup;
      geofenceLayerRef.current = geofenceGroup;
      mapInstanceRef.current = map;

      // Invalidate size once DOM container is calculated, then frame all locations
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
          fitAllFacilities();
        }
      }, 150);

      map.on("click", (e: L.LeafletMouseEvent) => {
        if (geofenceModeRef.current === "polygon") {
          const { lat, lng } = e.latlng;
          setPolygonVertices((prev) => [...prev, [lat, lng]]);
        }
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [fitAllFacilities]);

  // Tile layer switching
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    if (mapType === "satellite") {
      const satLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "Tiles &copy; Esri",
          maxZoom: 18,
          keepBuffer: 4,
        },
      );
      satLayer.addTo(map);
      tileLayerRef.current = satLayer;
    } else {
      const streetLayer = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
          keepBuffer: 4,
        },
      );
      streetLayer.addTo(map);
      tileLayerRef.current = streetLayer;
    }
  }, [mapType]);

  // Render Markers with Click Popups
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;
    const markersGroup = markersGroupRef.current;
    markersGroup.clearLayers();

    visibleFacilities.forEach((f) => {
      const isSelected = selectedFacility?.id === f.id;
      const color = getStatusColor(f.status);

      const markerHtml = `
        <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          ${
            isSelected
              ? `<div style="position: absolute; inset: -5px; border-radius: 50%; border: 2.5px solid ${color}; opacity: 0.8; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>`
              : f.status === "Active"
                ? `<div style="position: absolute; inset: -3px; border-radius: 50%; border: 1.5px solid ${color}; opacity: 0.35;"></div>`
                : ""
          }
          <div style="
            width: ${isSelected ? "24px" : "18px"};
            height: ${isSelected ? "24px" : "18px"};
            border-radius: 50%;
            background: ${color};
            border: 2px solid #ffffff;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-size: ${isSelected ? "10px" : "8px"};
            font-weight: 800;
            transition: all 0.2s ease;
          ">
            ${f.type === "authority_project" ? "★" : "●"}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: "leaflet-facility-marker",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
      });

      const marker = L.marker([f.lat, f.lng], { icon: customIcon });

      const districtName = getDistrictName(f.districtId, f.code);

      // Interactive Popup on Dot Click
      const popupHtml = `
        <div style="font-family: inherit; padding: 8px 10px; min-width: 210px; max-width: 260px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; gap: 6px;">
            <span style="font-family: monospace; font-size: 11px; font-weight: 800; background: #e2e8f0; color: #0c2a52; padding: 2px 6px; border-radius: 4px;">${f.code}</span>
            <span style="font-size: 10px; font-weight: 700; color: ${color};">● ${f.status}</span>
          </div>
          <div style="font-weight: 700; font-size: 13px; color: #0c2a52; line-height: 1.3; margin-bottom: 4px;">
            ${f.name}
          </div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">
            ${f.categoryLabel}
          </div>
          <div style="font-size: 11px; color: #334155; display: flex; flex-direction: column; gap: 2px; padding: 4px 0; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; margin-bottom: 8px;">
            <div><strong>District:</strong> ${districtName}</div>
            <div><strong>Capacity:</strong> ${f.capacityLabel}</div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button
              type="button"
              onclick="window.__netram_open_dossier && window.__netram_open_dossier('${f.id}')"
              style="flex: 1; padding: 5px 8px; font-size: 11px; font-weight: 700; background: #0c2a52; color: #ffffff; border: none; border-radius: 4px; cursor: pointer;"
            >
              Details
            </button>
            <a
              href="/projects/${f.id}"
              style="flex: 1; text-align: center; padding: 5px 8px; font-size: 11px; font-weight: 700; background: #15803d; color: #ffffff; text-decoration: none; border-radius: 4px; display: inline-block;"
            >
              Open →
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 280 });

      // Persistent location label directly visible on the map
      const shortName = f.name.length > 26 ? `${f.name.substring(0, 24)}…` : f.name;
      marker.bindTooltip(
        `<div class="netram-map-label ${isSelected ? "selected" : ""}">
          <span class="label-code">${f.code}</span>
          <span class="label-name" title="${f.name}">${shortName}</span>
        </div>`,
        {
          permanent: true,
          direction: "bottom",
          offset: [0, 8],
          className: `netram-leaflet-tooltip ${isSelected ? "selected" : ""}`,
        }
      );

      marker.on("click", () => {
        setSelectedProjectId(f.id);
      });

      marker.addTo(markersGroup);
    });
  }, [visibleFacilities, selectedFacility]);

  // Render Geofences
  useEffect(() => {
    if (!mapInstanceRef.current || !geofenceLayerRef.current) return;
    const geofenceGroup = geofenceLayerRef.current;
    geofenceGroup.clearLayers();

    if (!selectedFacility) return;

    const lat = selectedFacility.lat;
    const lng = selectedFacility.lng;

    if (geofenceMode === "polygon") {
      if (polygonVertices.length > 0) {
        L.polygon(polygonVertices, {
          color: "#2563eb",
          weight: 2.5,
          dashArray: "6, 6",
          fillColor: "#3b82f6",
          fillOpacity: 0.22,
        }).addTo(geofenceGroup);

        polygonVertices.forEach((pt, i) => {
          L.circleMarker(pt, {
            radius: 5,
            color: "#1d4ed8",
            fillColor: "#ffffff",
            fillOpacity: 1,
            weight: 2,
          })
            .bindTooltip(`Point ${i + 1}`, { permanent: false })
            .addTo(geofenceGroup);
        });
      }
    } else if (currentGeofence.type === "polygon" && currentGeofence.polygonPoints.length >= 3) {
      L.polygon(currentGeofence.polygonPoints, {
        color: "#16a34a",
        weight: 2.5,
        fillColor: "#22c55e",
        fillOpacity: 0.2,
      }).addTo(geofenceGroup);
    } else {
      const radius = geofenceMode === "circle" ? circleRadius : currentGeofence.radiusMeters;
      L.circle([lat, lng], {
        radius,
        color: geofenceMode === "circle" ? "#2563eb" : "#16a34a",
        weight: 2,
        dashArray: geofenceMode === "circle" ? "5, 5" : undefined,
        fillColor: geofenceMode === "circle" ? "#3b82f6" : "#22c55e",
        fillOpacity: 0.18,
      }).addTo(geofenceGroup);
    }
  }, [selectedFacility, geofenceMode, circleRadius, polygonVertices, currentGeofence]);

  // Seal Geofence
  const handleSealGeofence = async () => {
    if (!selectedFacility) return;

    if (!isAuthority) {
      alert("Only Authority Officers can seal geofences.");
      return;
    }

    if (geofenceMode === "polygon" && polygonVertices.length < 3) {
      alert("Draw at least 3 points for the perimeter.");
      return;
    }

    const payload = {
      type: geofenceMode === "polygon" ? "polygon" : "circle",
      radiusMeters: geofenceMode === "polygon" ? 0 : circleRadius,
      centerLat: selectedFacility.lat,
      centerLng: selectedFacility.lng,
      polygonVertices: geofenceMode === "polygon" ? polygonVertices : [],
    };

    let serverGeofence: GeofenceConfig | null = null;
    try {
      const res = await fetch(`/api/projects/${selectedFacility.id}/geofence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        serverGeofence = {
          type: data.type,
          radiusMeters: data.radiusMeters,
          polygonPoints: Array.isArray(data.polygonVertices) ? data.polygonVertices : [],
          sealedAt: data.sealedAt,
          sealedBy: "DSWO",
          auditTx: data.auditTx ?? undefined,
        };
      }
    } catch {
      // Offline fallback
    }

    const txHash = `0x${Math.random().toString(16).substring(2, 8)}...${Math.random().toString(16).substring(2, 6)}`;
    const newConfig: GeofenceConfig = serverGeofence ?? (
      geofenceMode === "polygon"
        ? {
            type: "polygon",
            radiusMeters: 0,
            polygonPoints: polygonVertices,
            sealedAt: new Date().toISOString(),
            sealedBy: "DSWO",
            auditTx: txHash,
          }
        : {
            type: "circle",
            radiusMeters: circleRadius,
            polygonPoints: [],
            sealedAt: new Date().toISOString(),
            sealedBy: "DSWO",
            auditTx: txHash,
          }
    );

    setGeofences((prev) => {
      const updated = {
        ...prev,
        [selectedFacility.id]: newConfig,
      };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // localStorage full or unavailable
        }
      }
      return updated;
    });

    setGeofenceMode("view");
    setPolygonVertices([]);
    setToastMessage(
      serverGeofence
        ? `Geofence sealed & synced to server for ${selectedFacility.code}`
        : `Geofence sealed locally for ${selectedFacility.code}`
    );
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleResetGeofence = () => {
    if (!selectedFacility || !isAuthority) return;

    setGeofences((prev) => {
      const next = { ...prev };
      delete next[selectedFacility.id];
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // localStorage unavailable
        }
      }
      return next;
    });

    setGeofenceMode("view");
    setPolygonVertices([]);
    setToastMessage(`Geofence reset to default for ${selectedFacility.code}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        minHeight: "440px",
        width: "100%",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid var(--color-border-strong)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        marginBottom: 0,
        background: "#e2e8f0",
      }}
    >
      {/* 1. Complete Leaflet Map DOM Canvas */}
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%", zIndex: 1 }} />

      {/* 2. Top-Right Cartographic Controls */}
      <div
        style={{
          position: "absolute",
          top: "1rem",
          right: showDrawer ? "365px" : "1rem",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          transition: "right 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Layer Switcher */}
        <div
          style={{
            display: "flex",
            background: "rgba(255, 255, 255, 0.96)",
            backdropFilter: "blur(8px)",
            borderRadius: "6px",
            border: "1px solid rgba(0,0,0,0.12)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            padding: "0.2rem",
          }}
        >
          <button
            type="button"
            onClick={() => setMapType("streets")}
            style={{
              border: "none",
              background: mapType === "streets" ? "var(--color-navy-dark)" : "transparent",
              color: mapType === "streets" ? "#ffffff" : "var(--text-muted)",
              padding: "0.25rem 0.55rem",
              borderRadius: "4px",
              fontSize: "0.74rem",
              fontWeight: mapType === "streets" ? 700 : 500,
              cursor: "pointer",
            }}
          >
            Map
          </button>
          <button
            type="button"
            onClick={() => setMapType("satellite")}
            style={{
              border: "none",
              background: mapType === "satellite" ? "var(--color-navy-dark)" : "transparent",
              color: mapType === "satellite" ? "#ffffff" : "var(--text-muted)",
              padding: "0.25rem 0.55rem",
              borderRadius: "4px",
              fontSize: "0.74rem",
              fontWeight: mapType === "satellite" ? 700 : 500,
              cursor: "pointer",
            }}
          >
            Satellite
          </button>
        </div>

        {/* Zoom to All Facilities */}
        <button
          type="button"
          onClick={fitAllFacilities}
          title="Zoom out to show all facility locations"
          style={{
            background: "rgba(255, 255, 255, 0.96)",
            backdropFilter: "blur(8px)",
            borderRadius: "6px",
            border: "1px solid rgba(0,0,0,0.12)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            padding: "0.35rem 0.6rem",
            fontSize: "0.74rem",
            fontWeight: 600,
            color: "var(--text-primary)",
            cursor: "pointer",
          }}
        >
          ↺ Zoom to All
        </button>

        {/* Toggle Details Drawer Button */}
        {!showDrawer && selectedFacility && (
          <button
            type="button"
            onClick={() => setShowDrawer(true)}
            style={{
              background: "var(--color-navy-dark)",
              color: "#ffffff",
              borderRadius: "6px",
              border: "none",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              padding: "0.35rem 0.75rem",
              fontSize: "0.74rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            <IconMapPin width={13} height={13} />
            <span>Details ({selectedFacility.code})</span>
          </button>
        )}
      </div>

      {/* 3. Bottom-Left Legend */}
      <div
        style={{
          position: "absolute",
          bottom: "1rem",
          left: "1rem",
          zIndex: 1000,
          background: "rgba(255, 255, 255, 0.94)",
          backdropFilter: "blur(6px)",
          borderRadius: "6px",
          border: "1px solid rgba(0,0,0,0.1)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          padding: "0.35rem 0.6rem",
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          fontSize: "0.68rem",
          color: "var(--text-secondary)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />
          <span>Active</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#d97706", display: "inline-block" }} />
          <span>Pending</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#64748b", display: "inline-block" }} />
          <span>Draft</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ width: 8, height: 8, borderRadius: "2px", border: "1px solid #16a34a", background: "rgba(34, 197, 94, 0.25)", display: "inline-block" }} />
          <span>Geofence</span>
        </div>
      </div>

      {/* 4. Bottom Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "absolute",
            bottom: "1.5rem",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(15, 23, 42, 0.95)",
            color: "#ffffff",
            padding: "0.5rem 1rem",
            borderRadius: "6px",
            fontSize: "0.78rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
            zIndex: 1100,
          }}
        >
          <IconCheck width={14} height={14} style={{ color: "#22c55e" }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 5. Geofencing Active Workflow Bar */}
      {geofenceMode !== "view" && selectedFacility && (
        <div
          style={{
            position: "absolute",
            bottom: "1rem",
            left: "1rem",
            right: showDrawer ? "365px" : "1rem",
            background: "rgba(255, 255, 255, 0.98)",
            backdropFilter: "blur(10px)",
            border: "2px solid #2563eb",
            borderRadius: "8px",
            padding: "0.65rem 1rem",
            zIndex: 1000,
            boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.6rem",
            transition: "right 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e40af" }}>
              {geofenceMode === "circle" ? "Circular Buffer" : "Campus Perimeter"} &bull; {selectedFacility.code}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
              {geofenceMode === "circle"
                ? `${circleRadius}m (${((Math.PI * circleRadius * circleRadius) / 10000).toFixed(1)} ha)`
                : `${polygonVertices.length} points placed (min 3)`}
            </div>
          </div>

          {/* Circle Mode Radius Slider & Presets */}
          {geofenceMode === "circle" && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{ display: "flex", gap: "0.2rem" }}>
                {[100, 250, 500].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCircleRadius(preset)}
                    style={{
                      padding: "0.2rem 0.4rem",
                      borderRadius: "4px",
                      fontSize: "0.7rem",
                      fontWeight: circleRadius === preset ? 700 : 500,
                      background: circleRadius === preset ? "#2563eb" : "var(--bg-subtle)",
                      color: circleRadius === preset ? "#ffffff" : "var(--text-secondary)",
                      border: "1px solid var(--color-border-strong)",
                      cursor: "pointer",
                    }}
                  >
                    {preset}m
                  </button>
                ))}
              </div>
              <input
                type="range"
                min={50}
                max={1000}
                step={25}
                value={circleRadius}
                onChange={(e) => setCircleRadius(parseInt(e.target.value, 10))}
                style={{ width: "100px", cursor: "pointer" }}
              />
              <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--text-primary)", minWidth: "36px" }}>
                {circleRadius}m
              </span>
            </div>
          )}

          {/* Polygon Drawing Controls */}
          {geofenceMode === "polygon" && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              {polygonVertices.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPolygonVertices((prev) => prev.slice(0, -1))}
                  style={{
                    padding: "0.2rem 0.5rem",
                    borderRadius: "4px",
                    fontSize: "0.72rem",
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--color-border-strong)",
                    cursor: "pointer",
                  }}
                >
                  Undo
                </button>
              )}
              {polygonVertices.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPolygonVertices([])}
                  style={{
                    padding: "0.2rem 0.5rem",
                    borderRadius: "4px",
                    fontSize: "0.72rem",
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--color-border-strong)",
                    cursor: "pointer",
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Workflow Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <button
              type="button"
              onClick={() => {
                setGeofenceMode("view");
                setPolygonVertices([]);
              }}
              style={{
                padding: "0.3rem 0.65rem",
                borderRadius: "5px",
                fontSize: "0.74rem",
                background: "var(--bg-subtle)",
                border: "1px solid var(--color-border-strong)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSealGeofence}
              disabled={geofenceMode === "polygon" && polygonVertices.length < 3}
              style={{
                padding: "0.3rem 0.75rem",
                borderRadius: "5px",
                fontSize: "0.74rem",
                background: geofenceMode === "polygon" && polygonVertices.length < 3 ? "#94a3b8" : "#16a34a",
                color: "#ffffff",
                border: "none",
                fontWeight: 700,
                cursor: geofenceMode === "polygon" && polygonVertices.length < 3 ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
              }}
            >
              <IconShieldCheck width={13} height={13} />
              <span>Seal Geofence</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. Collapsible Facility Dossier Sidebar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "350px",
          background: "rgba(255, 255, 255, 0.98)",
          backdropFilter: "blur(12px)",
          borderLeft: "1px solid rgba(0,0,0,0.15)",
          boxShadow: "-4px 0 20px rgba(0,0,0,0.12)",
          zIndex: 1001,
          display: "flex",
          flexDirection: "column",
          transform: showDrawer ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {selectedFacility && (
          <>
            {/* Header */}
            <div
              style={{
                padding: "0.85rem 1.1rem",
                background: "var(--bg-subtle)",
                borderBottom: "1px solid var(--color-border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <IconShieldCheck width={16} height={16} style={{ color: "var(--action-green-dark)" }} />
                <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--color-navy-brand)" }}>
                  FACILITY DOSSIER
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowDrawer(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--text-muted)",
                  fontSize: "1.25rem",
                  lineHeight: 1,
                  cursor: "pointer",
                  padding: "0.15rem 0.35rem",
                }}
                title="Close panel"
              >
                &times;
              </button>
            </div>

            {/* Body */}
            <div
              style={{
                padding: "1rem 1.1rem",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "0.85rem",
                flex: 1,
              }}
            >
              {/* Code & Status */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="code-badge" style={{ fontSize: "0.75rem", fontWeight: 800 }}>
                  {selectedFacility.code}
                </span>
                <StatusBadge status={selectedFacility.status} />
              </div>

              {/* Title */}
              <div>
                <h3
                  style={{
                    margin: "0 0 0.2rem 0",
                    fontSize: "0.98rem",
                    fontWeight: 800,
                    color: "var(--color-navy-brand)",
                    lineHeight: 1.35,
                  }}
                >
                  {selectedFacility.name}
                </h3>
                <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                  {selectedFacility.categoryLabel}
                </div>
              </div>

              {/* Specifications */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.45rem",
                  fontSize: "0.76rem",
                  background: "var(--bg-subtle)",
                  padding: "0.65rem 0.8rem",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border-subtle)",
                }}
              >
                <div>
                  <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.66rem", fontWeight: 700 }}>
                    JURISDICTION
                  </span>
                  <strong>{getDistrictName(selectedFacility.districtId, selectedFacility.code)} District</strong>
                </div>

                <div>
                  <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.66rem", fontWeight: 700 }}>
                    OPERATING AGENCY
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <IconBuilding width={13} height={13} style={{ color: "var(--text-muted)" }} />
                    <strong>{getOrganisationName(selectedFacility.organisationId)}</strong>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", marginTop: "0.1rem" }}>
                  <div>
                    <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.66rem", fontWeight: 700 }}>
                      CAPACITY
                    </span>
                    <span>{selectedFacility.capacityLabel}</span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.66rem", fontWeight: 700 }}>
                      COORDINATES
                    </span>
                    <span style={{ fontFamily: "monospace", fontSize: "0.72rem" }}>
                      {selectedFacility.lat.toFixed(4)}°, {selectedFacility.lng.toFixed(4)}°
                    </span>
                  </div>
                </div>
              </div>

              {/* Geofence Card */}
              <div
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--color-border-strong)",
                  borderRadius: "8px",
                  padding: "0.75rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.4rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <IconMapPin width={14} height={14} style={{ color: "#16a34a" }} />
                    <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--text-primary)" }}>
                      STATUTORY GEOFENCE
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      background: "#dcfce7",
                      color: "#15803d",
                      padding: "0.08rem 0.35rem",
                      borderRadius: "3px",
                      fontWeight: 800,
                    }}
                  >
                    SEALED
                  </span>
                </div>

                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                  {currentGeofence.type === "polygon"
                    ? `Perimeter Polygon (${currentGeofence.polygonPoints.length} points)`
                    : `Circular Radius: ${currentGeofence.radiusMeters}m`}
                </div>

                {isAuthority ? (
                  geofenceMode === "view" ? (
                    <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.2rem" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setCircleRadius(currentGeofence.radiusMeters || 250);
                          setGeofenceMode("circle");
                        }}
                        style={{
                          flex: 1,
                          padding: "0.3rem 0.45rem",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          background: "var(--bg-subtle)",
                          border: "1px solid var(--color-border-strong)",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        Adjust Buffer
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPolygonVertices([[selectedFacility.lat, selectedFacility.lng]]);
                          setGeofenceMode("polygon");
                        }}
                        style={{
                          flex: 1,
                          padding: "0.3rem 0.45rem",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          background: "var(--bg-subtle)",
                          border: "1px solid var(--color-border-strong)",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        Draw Polygon
                      </button>
                      {geofences[selectedFacility.id] && (
                        <button
                          type="button"
                          onClick={handleResetGeofence}
                          title="Reset geofence"
                          style={{
                            padding: "0.3rem 0.45rem",
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            background: "transparent",
                            border: "1px solid var(--color-border-subtle)",
                            borderRadius: "4px",
                            cursor: "pointer",
                            color: "var(--text-muted)",
                          }}
                        >
                          ↺
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.7rem", color: "#2563eb", fontWeight: 600 }}>
                      ● Editing geofence on map
                    </div>
                  )
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      background: "var(--bg-subtle)",
                      padding: "0.35rem 0.5rem",
                      borderRadius: "4px",
                      fontSize: "0.68rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    <IconLock width={12} height={12} />
                    <span>Locked</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "auto", paddingTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => flyToFacility(selectedFacility.lat, selectedFacility.lng)}
                  style={{
                    padding: "0.4rem",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--color-border-strong)",
                    borderRadius: "5px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.3rem",
                  }}
                >
                  <IconMapPin width={13} height={13} />
                  <span>Center on Map</span>
                </button>

                <Link
                  href={`/projects/${selectedFacility.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.35rem",
                    padding: "0.5rem 0.85rem",
                    background: "linear-gradient(to right, var(--action-green), var(--action-green-dark))",
                    color: "#ffffff",
                    borderRadius: "6px",
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    textDecoration: "none",
                    boxShadow: "0 2px 6px rgba(22, 163, 74, 0.25)",
                  }}
                >
                  <span>Open Facility</span>
                  <IconChevronRight width={14} height={14} />
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
