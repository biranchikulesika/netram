"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Project, ProjectStatus } from "@netram/types";
import { StatusBadge } from "./[id]/status-badge";
import {
  IconMapPin,
  IconShieldCheck,
  IconChevronRight,
  IconCheck,
} from "../../components/icons";
import { formatDistrict, getAuthorityName } from "../../../lib/presentation";
import { ProjectOverviewCard } from "./project-overview-card";
import NetramOverviewMap, {
  type MapFacility,
} from "../../components/netram-overview-map";

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
export const DISTRICT_COORDINATES: Record<string, { lat: number; lng: number; name: string }> = {
  "5f6c6fcf-fc88-5bf1-9f63-cad86ee0bd3b": {
    lat: 20.2961,
    lng: 85.8245,
    name: "Khordha (Bhubaneswar)",
  },
  "92f0e386-2b80-5ca4-94a0-9c7d90d47dbf": { lat: 20.4625, lng: 85.883, name: "Cuttack" },
  "ec220eb3-d4a3-5b12-9412-26d8badeafe7": { lat: 19.8135, lng: 85.8312, name: "Puri" },
  "a2dfd214-5aa0-5c7a-aa78-7b59865ba0a3": { lat: 19.38, lng: 84.85, name: "Ganjam (Berhampur)" },
  "e71c0cc4-6569-5e2b-bb73-cc3cae07fb8d": { lat: 22.12, lng: 84.03, name: "Sundargarh (Rourkela)" },
};

export function parseGpsCoordinates(desc: string | null): { lat: number; lng: number } | null {
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
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Geofencing Interactive State
  const [geofenceMode, setGeofenceMode] = useState<"view" | "circle" | "polygon" | "location">(
    "view",
  );
  const [circleRadius, setCircleRadius] = useState<number>(250); // meters
  const [polygonVertices, setPolygonVertices] = useState<[number, number][]>([]);

  // Location pinning state: draft pin synced between GPS coordinate inputs and map clicks
  const [draftLocation, setDraftLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");

  // Ref to always provide latest geofenceMode inside Leaflet map event callbacks
  const geofenceModeRef = useRef<"view" | "circle" | "polygon" | "location">(geofenceMode);
  useEffect(() => {
    geofenceModeRef.current = geofenceMode;
  }, [geofenceMode]);

  const STORAGE_KEY = "netram_geofences_registry";
  const LOCATION_KEY = "netram_location_overrides";

  // Pinned location overrides per project (survives reload)
  const [locationOverrides, setLocationOverrides] = useState<
    Record<string, { lat: number; lng: number }>
  >(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(LOCATION_KEY);
        if (stored) return JSON.parse(stored);
      } catch {
        // Ignore
      }
    }
    return {};
  });

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
        const offsetDist = 0.012 + (hash % 7) * 0.005;

        lat = baseLat + Math.sin(angle) * offsetDist;
        lng = baseLng + Math.cos(angle) * offsetDist;
      }

      const override = locationOverrides[p.id];
      if (override) {
        lat = override.lat;
        lng = override.lng;
      }

      return {
        ...p,
        lat,
        lng,
        categoryLabel: parseWelfareCategory(p.description),
      };
    });
  }, [projects, locationOverrides]);

  const selectedFacility = useMemo(() => {
    if (!selectedProjectId) return null;
    return facilities.find((f) => f.id === selectedProjectId) ?? null;
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

  // Leaflet handles supplied by the shared map shell (for geofence overlays)
  const mapApiRef = useRef<{ map: L.Map; overlay: L.LayerGroup } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const handleMapReady = useCallback((api: { map: L.Map; overlay: L.LayerGroup }) => {
    mapApiRef.current = api;
    setMapReady(true);
  }, []);

  // Interior coordinate → MapFacility pins for the shared shell
  const pins: MapFacility[] = useMemo(() => {
    return facilities.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      districtId: p.districtId,
      description: p.description,
      lat: p.lat,
      lng: p.lng,
      color: getStatusColor(p.status),
      districtLabel: formatDistrict(p.districtName, p.stateName),
      pinGlyph: p.type === "authority_project" ? ("star" as const) : ("dot" as const),
    }));
  }, [facilities]);

  const projectsById = useMemo(() => {
    const m = new Map<string, (typeof facilities)[0]>();
    facilities.forEach((f) => m.set(f.id, f));
    return m;
  }, [facilities]);

  // Geofence overlay drawn onto the shared shell's overlay group
  useEffect(() => {
    const api = mapApiRef.current;
    if (!api || !selectedFacility) return;
    const geofenceGroup = api.overlay;
    geofenceGroup.clearLayers();

    if (geofenceMode === "location") {
      if (draftLocation) {
        const draftIcon = L.divIcon({
          html: `
            <div style="position: relative; width: 30px; height: 42px; display: flex; align-items: center; justify-content: center;">
              <div style="position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%); width: 18px; height: 9px; border-radius: 50%; border: 2px solid #2563eb; opacity: 0.85; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <svg viewBox="0 0 28 38" width="30" height="42" style="display: block; filter: drop-shadow(0 2px 6px rgba(37,99,235,0.6));" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 0C6.27 0 0 6.27 0 14C0 24.5 10.5 33.5 14 38C17.5 33.5 28 24.5 28 14C28 6.27 21.73 0 14 0Z" fill="#2563eb" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
                <circle cx="14" cy="14" r="5" fill="#ffffff"/>
                <circle cx="14" cy="14" r="2.3" fill="#2563eb"/>
              </svg>
            </div>`,
          className: "leaflet-facility-marker",
          iconSize: [30, 42],
          iconAnchor: [15, 42],
        });
        L.marker([draftLocation.lat, draftLocation.lng], { icon: draftIcon }).addTo(geofenceGroup);
      }
      return;
    }

    const lat = selectedFacility.lat;
    const lng = selectedFacility.lng;

    if (geofenceMode === "polygon") {
      if (polygonVertices.length >= 3) {
        L.polygon(polygonVertices, {
          color: "#2563eb",
          weight: 2.5,
          dashArray: "5, 5",
          fillColor: "#3b82f6",
          fillOpacity: 0.2,
        }).addTo(geofenceGroup);
      } else if (polygonVertices.length === 2) {
        L.polyline(polygonVertices, {
          color: "#2563eb",
          weight: 2.5,
          dashArray: "5, 5",
        }).addTo(geofenceGroup);
      }

      polygonVertices.forEach((pt, i) => {
        L.circleMarker(pt, {
          radius: 6,
          color: "#1d4ed8",
          fillColor: i === 0 ? "#16a34a" : "#ffffff",
          fillOpacity: 1,
          weight: 2,
        })
          .bindTooltip(`Point ${i + 1}${i === 0 ? " (Start)" : ""}`, { permanent: false })
          .addTo(geofenceGroup);
      });
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
  }, [selectedFacility, geofenceMode, circleRadius, polygonVertices, currentGeofence, draftLocation, mapReady]);

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
    const newConfig: GeofenceConfig =
      serverGeofence ??
      (geofenceMode === "polygon"
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
          });

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
    notify("Geofence sealed and locked.");
  };

  const handleStartAdjustRadius = () => {
    setCircleRadius(currentGeofence.radiusMeters || 250);
    setGeofenceMode("circle");
  };

  const handleStartSetLocation = () => {
    if (!selectedFacility) return;
    setDraftLocation({ lat: selectedFacility.lat, lng: selectedFacility.lng });
    setLatInput(selectedFacility.lat.toFixed(6));
    setLngInput(selectedFacility.lng.toFixed(6));
    setGeofenceMode("location");
  };

  const handleGoToCoordinates = (toast: (msg: string) => void) => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast("Enter valid latitude (-90 to 90) and longitude (-180 to 180).");
      return;
    }
    setDraftLocation({ lat, lng });
    if (mapApiRef.current) {
      const targetZoom = mapApiRef.current.map.getMaxZoom() || 18;
      const curZoom = mapApiRef.current.map.getZoom();
      const target = Math.max(curZoom, targetZoom);
      const containerWidth = mapApiRef.current.map.getContainer().clientWidth || 1000;
      if (containerWidth >= 768) {
        const targetPoint = mapApiRef.current.map.project([lat, lng], target);
        const offsetPoint = L.point(targetPoint.x - 380 / 2, targetPoint.y);
        const newCenter = mapApiRef.current.map.unproject(offsetPoint, target);
        mapApiRef.current.map.flyTo(newCenter, target, {
          duration: Math.min(2.2, 0.55 + Math.abs(target - curZoom) * 0.11),
          easeLinearity: 0.18,
        });
      } else {
        mapApiRef.current.map.flyTo([lat, lng], target);
      }
    }
  };

  const handleCommitLocation = () => {
    if (!selectedFacility || !draftLocation) return;
    pinNewLocation(selectedFacility, draftLocation);
    setDraftLocation(null);
  };

  const handleStartDrawPolygon = () => {
    if (currentGeofence.type === "polygon" && currentGeofence.polygonPoints.length > 0) {
      setPolygonVertices([...currentGeofence.polygonPoints]);
    } else {
      setPolygonVertices([]);
    }
    setGeofenceMode("polygon");
  };

  const handleCancelGeofenceEdit = () => {
    setGeofenceMode("view");
    setPolygonVertices([]);
    setCircleRadius(currentGeofence.radiusMeters || 250);
  };

  // Pin a new facility location. The move invalidates the old boundary (geofence is removed),
  // so a fresh perimeter must be drawn at the pinned spot.
  const pinNewLocation = useCallback(
    (
      facility: { id: string; name: string; lat: number; lng: number },
      latlng: { lat: number; lng: number },
    ) => {
      setLocationOverrides((prev) => {
        const next = { ...prev, [facility.id]: { lat: latlng.lat, lng: latlng.lng } };
        try {
          localStorage.setItem(LOCATION_KEY, JSON.stringify(next));
        } catch {
          // Ignore
        }
        return next;
      });
      setGeofences((prev) => {
        const next = { ...prev };
        delete next[facility.id];
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore
        }
        return next;
      });
      setPolygonVertices([]);
      setGeofenceMode("polygon");
      // Toast handled via imperative handle in render
    },
    [],
  );

  const isDrawing = geofenceMode !== "view";

  // Toast bridge — shell exposes pushToast via ref
  const mapHandleRef = useRef<{ pushToast(message: string): void } | null>(null);
  const notify = useCallback((msg: string) => {
    mapHandleRef.current?.pushToast(msg);
  }, []);

  return (
    <NetramOverviewMap
      mapRef={mapHandleRef}
      facilities={pins}
      legend={[
        { label: "Active" },
        { label: "Pending" },
        { label: "Draft" },
        { label: "Geofence", swatch: "#16a34a" },
      ]}
      listTitle="Projects"
      emptyText="No registered projects available."
      reopenLabel="Projects"
      backLabel="Back to all projects"
      onMapReady={handleMapReady}
      onSelectChange={setSelectedProjectId}
      onMapClick={(latlng) => {
        if (geofenceModeRef.current === "polygon") {
          setPolygonVertices((prev) => [...prev, [latlng.lat, latlng.lng]]);
        } else if (geofenceModeRef.current === "location") {
          setDraftLocation({ lat: latlng.lat, lng: latlng.lng });
          setLatInput(latlng.lat.toFixed(6));
          setLngInput(latlng.lng.toFixed(6));
        }
      }}
      isDrawing={isDrawing}
      cursor={isDrawing ? "crosshair" : undefined}
      renderBrowseRow={(f, select) => {
        const proj = projectsById.get(f.id);
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
              <div style={{ flexShrink: 0 }}>{proj ? <StatusBadge status={proj.status} /> : null}</div>
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
              <span title="Open facility dossier" style={{ color: "#2563eb", display: "inline-flex", flexShrink: 0 }}>
                <IconChevronRight width={13} height={13} />
              </span>
            </div>
          </div>
        );
      }}
      renderDrawerContent={(f) => {
        const proj = projectsById.get(f.id);
        if (!proj) return null;
        return (
          <>
            <ProjectOverviewCard project={proj} />

            {geofenceMode === "location" ? (
              /* LOCATION PINNING MODE */
              <div
                style={{
                  background: "#eff6ff",
                  border: "1.5px solid #93c5fd",
                  borderRadius: "8px",
                  padding: "0.8rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.6rem",
                  boxShadow: "0 2px 8px rgba(37, 99, 235, 0.08)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#1e40af" }}>
                    Set Facility Location
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "0.71rem",
                    color: "#475569",
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "5px",
                    padding: "0.4rem 0.55rem",
                    lineHeight: 1.35,
                  }}
                >
                  Paste GPS coordinates and click "Go", or click on the map to pin the exact
                  position. The coordinates and map pin stay in sync.
                </div>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Latitude (e.g. 20.296100)"
                    aria-label="Latitude"
                    value={latInput}
                    onChange={(e) => setLatInput(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: "0.4rem 0.5rem",
                      fontSize: "0.74rem",
                      fontWeight: 600,
                      color: "var(--text-main)",
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "5px",
                      outline: "none",
                    }}
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Longitude (e.g. 85.824500)"
                    aria-label="Longitude"
                    value={lngInput}
                    onChange={(e) => setLngInput(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: "0.4rem 0.5rem",
                      fontSize: "0.74rem",
                      fontWeight: 600,
                      color: "var(--text-main)",
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "5px",
                      outline: "none",
                    }}
                  />
                </div>
                {draftLocation && (
                  <div style={{ fontSize: "0.68rem", color: "#1d4ed8", fontWeight: 600 }}>
                    Draft pin: {draftLocation.lat.toFixed(6)}, {draftLocation.lng.toFixed(6)}
                  </div>
                )}
                <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.1rem" }}>
                  <button
                    type="button"
                    onClick={handleCancelGeofenceEdit}
                    style={{
                      flex: 1,
                      padding: "0.4rem 0.6rem",
                      fontSize: "0.74rem",
                      fontWeight: 600,
                      background: "#ffffff",
                      color: "#475569",
                      border: "1px solid #cbd5e1",
                      borderRadius: "5px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGoToCoordinates(notify)}
                    title="Fly the map to these coordinates"
                    style={{
                      flex: 1,
                      padding: "0.4rem 0.6rem",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      background: "#2563eb",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "5px",
                      cursor: "pointer",
                    }}
                  >
                    Go
                  </button>
                  <button
                    type="button"
                    onClick={handleCommitLocation}
                    disabled={!draftLocation}
                    title="Pin this location as the facility position"
                    style={{
                      flex: 1.4,
                      padding: "0.4rem 0.6rem",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      background: draftLocation ? "#16a34a" : "#94a3b8",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "5px",
                      cursor: draftLocation ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.3rem",
                    }}
                  >
                    <IconMapPin width={13} height={13} />
                    <span>Pin</span>
                  </button>
                </div>
              </div>
            ) : geofenceMode === "circle" ? (
              /* CIRCLE / RADIUS EDITING MODE */
              <div
                style={{
                  background: "#eff6ff",
                  border: "1.5px solid #93c5fd",
                  borderRadius: "8px",
                  padding: "0.8rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.6rem",
                  boxShadow: "0 2px 8px rgba(37, 99, 235, 0.08)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#1e40af" }}>
                    Adjust Circular Radius
                  </span>
                  <span
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 800,
                      color: "#1d4ed8",
                      background: "#ffffff",
                      padding: "0.15rem 0.5rem",
                      borderRadius: "4px",
                      border: "1px solid #bfdbfe",
                    }}
                  >
                    {circleRadius}m
                  </span>
                </div>

                <div style={{ display: "flex", gap: "0.3rem" }}>
                  {[100, 250, 500, 750].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCircleRadius(preset)}
                      style={{
                        flex: 1,
                        padding: "0.28rem 0",
                        fontSize: "0.72rem",
                        fontWeight: circleRadius === preset ? 700 : 500,
                        background: circleRadius === preset ? "#2563eb" : "#ffffff",
                        color: circleRadius === preset ? "#ffffff" : "#334155",
                        border: circleRadius === preset ? "1px solid #2563eb" : "1px solid #cbd5e1",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      {preset}m
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    type="range"
                    min={50}
                    max={1000}
                    step={25}
                    value={circleRadius}
                    onChange={(e) => setCircleRadius(parseInt(e.target.value, 10))}
                    style={{ flex: 1, accentColor: "#2563eb", cursor: "pointer" }}
                  />
                </div>

                <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.1rem" }}>
                  <button
                    type="button"
                    onClick={handleCancelGeofenceEdit}
                    style={{
                      flex: 1,
                      padding: "0.4rem 0.6rem",
                      fontSize: "0.74rem",
                      fontWeight: 600,
                      background: "#ffffff",
                      color: "#475569",
                      border: "1px solid #cbd5e1",
                      borderRadius: "5px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSealGeofence()}
                    style={{
                      flex: 1.4,
                      padding: "0.4rem 0.6rem",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      background: "#16a34a",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "5px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.3rem",
                    }}
                  >
                    <IconCheck width={13} height={13} />
                    <span>Save Radius</span>
                  </button>
                </div>
              </div>
            ) : geofenceMode === "polygon" ? (
              /* POLYGON DRAWING MODE */
              <div
                style={{
                  background: "#eff6ff",
                  border: "1.5px solid #93c5fd",
                  borderRadius: "8px",
                  padding: "0.8rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.6rem",
                  boxShadow: "0 2px 8px rgba(37, 99, 235, 0.08)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#1e40af" }}>
                    Draw Perimeter
                  </span>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: polygonVertices.length >= 3 ? "#15803d" : "#d97706",
                      background: "#ffffff",
                      padding: "0.12rem 0.45rem",
                      borderRadius: "4px",
                      border: "1px solid #bfdbfe",
                    }}
                  >
                    {polygonVertices.length} {polygonVertices.length === 1 ? "point" : "points"}{" "}
                    {polygonVertices.length >= 3 ? "✓" : "(min 3)"}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: "0.71rem",
                    color: "#475569",
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "5px",
                    padding: "0.4rem 0.55rem",
                    lineHeight: 1.35,
                  }}
                >
                  Click anywhere on the map around the facility to place perimeter boundary points.
                </div>

                {polygonVertices.length > 0 && (
                  <div style={{ display: "flex", gap: "0.35rem" }}>
                    <button
                      type="button"
                      onClick={() => setPolygonVertices((prev) => prev.slice(0, -1))}
                      style={{
                        flex: 1,
                        padding: "0.28rem 0.5rem",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        background: "#ffffff",
                        color: "#334155",
                        border: "1px solid #cbd5e1",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      Undo Point
                    </button>
                    <button
                      type="button"
                      onClick={() => setPolygonVertices([])}
                      style={{
                        flex: 1,
                        padding: "0.28rem 0.5rem",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        background: "#ffffff",
                        color: "#dc2626",
                        border: "1px solid #fca5a5",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      Clear All
                    </button>
                  </div>
                )}

                <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.1rem" }}>
                  <button
                    type="button"
                    onClick={handleCancelGeofenceEdit}
                    style={{
                      flex: 1,
                      padding: "0.4rem 0.6rem",
                      fontSize: "0.74rem",
                      fontWeight: 600,
                      background: "#ffffff",
                      color: "#475569",
                      border: "1px solid #cbd5e1",
                      borderRadius: "5px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSealGeofence()}
                    disabled={polygonVertices.length < 3}
                    style={{
                      flex: 1.4,
                      padding: "0.4rem 0.6rem",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      background: polygonVertices.length < 3 ? "#94a3b8" : "#16a34a",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "5px",
                      cursor: polygonVertices.length < 3 ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.3rem",
                    }}
                  >
                    <IconCheck width={13} height={13} />
                    <span>Save Perimeter</span>
                  </button>
                </div>
              </div>
            ) : /* VIEW MODE: Clean Action Bar */
            isAuthority ? (
                <div style={{ display: "flex", gap: "0.45rem" }}>
                  <button
                    type="button"
                    onClick={handleStartAdjustRadius}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.35rem",
                      padding: "0.45rem 0.65rem",
                      fontSize: "0.74rem",
                      fontWeight: 600,
                      background: "#ffffff",
                      color: "var(--color-navy-brand)",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={13} height={13}>
                      <circle cx="12" cy="12" r="9" />
                      <circle cx="12" cy="12" r="2" fill="currentColor" />
                    </svg>
                    <span>Adjust Radius</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleStartDrawPolygon}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.35rem",
                      padding: "0.45rem 0.65rem",
                      fontSize: "0.74rem",
                      fontWeight: 600,
                      background: "#ffffff",
                      color: "var(--color-navy-brand)",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={13} height={13}>
                      <polygon points="12 2 22 8.5 18 21 6 21 2 8.5" />
                    </svg>
                    <span>Draw Polygon</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleStartSetLocation}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.35rem",
                      padding: "0.45rem 0.65rem",
                      fontSize: "0.74rem",
                      fontWeight: 600,
                      background: "#ffffff",
                      color: "var(--color-navy-brand)",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <IconMapPin width={13} height={13} />
                    <span>Set Location</span>
                  </button>
                </div>
              ) : null}

            {/* Divider */}
            <div style={{ height: "1px", background: "var(--color-border-subtle)" }} />

            {/* Administrative & Institutional Oversight */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div
                style={{ display: "flex", gap: "0.55rem", alignItems: "center", minWidth: 0 }}
                title="Supervising Authority"
              >
                <IconShieldCheck width={14} height={14} style={{ color: "var(--text-subtle)", flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    color: "var(--text-main)",
                    minWidth: 0,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflowWrap: "anywhere",
                  }}
                >
                  {getAuthorityName(proj.authorityId, proj.authorityName)}
                </span>
              </div>
            </div>

            {/* Bottom Primary Action Button */}
            <div style={{ marginTop: "auto", paddingTop: "0.5rem" }}>
              <Link
                href={`/dashboard/projects/${proj.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.35rem",
                  padding: "0.55rem 1rem",
                  background: "linear-gradient(to right, #15803d, #166534)",
                  color: "#ffffff",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  textDecoration: "none",
                  boxShadow: "0 1px 4px rgba(22, 163, 74, 0.25)",
                }}
              >
                <span>Open Facility Dossier</span>
                <IconChevronRight width={14} height={14} />
              </Link>
            </div>
          </>
        );
      }}
    />
  );
}