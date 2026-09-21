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
  IconChevronLeft,
  IconCheck,
  IconX,
} from "../components/icons";
import { getDistrictName, getAuthorityName } from "../../lib/presentation";
import { ProjectOverviewCard } from "./project-overview-card";

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
  // No projects selected by default; show full map with left-side browse list (Google Maps style)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  // Default drawer open on the left so user immediately sees the browse list of all projects
  const [showDrawer, setShowDrawer] = useState<boolean>(true);

  // Zoom-aware location label display (Google Maps style)
  // When zoomed out (< 10), unselected facility labels hide; when zoomed in (>= 10), all labels show.
  const ZOOM_LABEL_THRESHOLD = 10;
  const [isZoomedIn, setIsZoomedIn] = useState<boolean>(false);

  // Geofencing Interactive State
  const [geofenceMode, setGeofenceMode] = useState<"view" | "circle" | "polygon" | "location">(
    "view",
  );
  const [circleRadius, setCircleRadius] = useState<number>(250); // meters
  const [polygonVertices, setPolygonVertices] = useState<[number, number][]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Location pinning state: draft pin synced between GPS coordinate inputs and map clicks
  const [draftLocation, setDraftLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");

  // Ref to always provide latest geofenceMode inside Leaflet map event callbacks
  const geofenceModeRef = useRef<"view" | "circle" | "polygon" | "location">(geofenceMode);
  useEffect(() => {
    geofenceModeRef.current = geofenceMode;
    if (mapContainerRef.current) {
      mapContainerRef.current.style.cursor =
        geofenceMode === "polygon" || geofenceMode === "location" ? "crosshair" : "";
      if (geofenceMode === "polygon") {
        mapContainerRef.current.classList.add("drawing-polygon");
      } else {
        mapContainerRef.current.classList.remove("drawing-polygon");
      }
    }
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

  const visibleFacilities = facilities;

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

  // Focus on a facility with Google Maps-style offset so it centers in the right-hand visible map area.
  // Flies to the map's maximum zoom (capped to keep tiles sharp in both street/satellite modes) with a
  // duration that scales with the journey length for a consistently smooth flight.
  const focusFacility = useCallback((lat: number, lng: number, withOffset = true) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const maxZoom = map.getMaxZoom() || 18;
    const targetZoom = Math.max(map.getZoom(), maxZoom);

    const containerWidth =
      mapContainerRef.current?.clientWidth ??
      (typeof window !== "undefined" ? window.innerWidth : 1000);
    const isDesktop = containerWidth >= 768;

    // Longer zoom journeys get proportionally longer (gently capped) flights
    const zoomDelta = Math.abs(targetZoom - map.getZoom());
    const duration = Math.min(2.2, 0.55 + zoomDelta * 0.11);

    if (withOffset && isDesktop) {
      const panelWidth = 380;
      // Project target lat/lng to container pixel coordinates at targetZoom
      const targetPoint = map.project([lat, lng], targetZoom);
      // Center the marker in the open right portion of the container
      const offsetPoint = L.point(targetPoint.x - panelWidth / 2, targetPoint.y);
      const newCenter = map.unproject(offsetPoint, targetZoom);
      map.flyTo(newCenter, targetZoom, { duration, easeLinearity: 0.18 });
    } else {
      map.flyTo([lat, lng], targetZoom, { duration, easeLinearity: 0.18 });
    }
  }, []);

  // Smoothly pan map by specified dx/dy pixel offsets (accessible 4-directional navigation)
  const panMap = useCallback((dx: number, dy: number) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.panBy([dx, dy], { animate: true, duration: 0.25 });
  }, []);

  // Smoothly zoom in / out
  const handleZoomIn = useCallback(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.zoomOut();
  }, []);

  const handleSelectFacility = useCallback(
    (f: (typeof facilities)[0]) => {
      setSelectedProjectId(f.id);
      setShowDrawer(true);
      focusFacility(f.lat, f.lng, true);
    },
    [focusFacility],
  );

  // Expose helper on window for popup or DOM button interactions
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__netram_select_facility = (id: string) => {
      if (geofenceModeRef.current === "polygon") return;
      const facility = facilities.find((f) => f.id === id);
      if (facility) {
        handleSelectFacility(facility);
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__netram_open_dossier = (id: string) => {
      const facility = facilities.find((f) => f.id === id);
      if (facility) {
        handleSelectFacility(facility);
      }
    };
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__netram_select_facility;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__netram_open_dossier;
    };
  }, [facilities, handleSelectFacility]);

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

  // Pin a new facility location. The move invalidates the old boundary (geofence is removed),
  // so a fresh perimeter must be drawn at the pinned spot.
  const pinNewLocation = useCallback(
    (facility: (typeof facilities)[0], latlng: { lat: number; lng: number }) => {
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
      setToastMessage(`Location pinned for ${facility.name}. Draw the new perimeter.`);
      setTimeout(() => setToastMessage(null), 3000);
    },
    [],
  );

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

      const streetLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
        keepBuffer: 4,
      });
      streetLayer.addTo(map);
      tileLayerRef.current = streetLayer;

      const markersGroup = L.layerGroup().addTo(map);
      const geofenceGroup = L.layerGroup().addTo(map);

      markersGroupRef.current = markersGroup;
      geofenceLayerRef.current = geofenceGroup;
      mapInstanceRef.current = map;

      // Invalidate size once DOM container is calculated
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 150);

      // Track zoom level for Google Maps-style label display (threshold >= 10)
      const handleZoomChange = () => {
        const z = map.getZoom();
        setIsZoomedIn((prev) => {
          const next = z >= ZOOM_LABEL_THRESHOLD;
          return prev !== next ? next : prev;
        });
      };
      map.on("zoomend", handleZoomChange);
      handleZoomChange();

      map.on("click", (e: L.LeafletMouseEvent) => {
        if (geofenceModeRef.current === "polygon") {
          const { lat, lng } = e.latlng;
          setPolygonVertices((prev) => [...prev, [lat, lng]]);
        } else if (geofenceModeRef.current === "location") {
          const { lat, lng } = e.latlng;
          setDraftLocation({ lat, lng });
          setLatInput(lat.toFixed(6));
          setLngInput(lng.toFixed(6));
        }
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Fit all facilities once the first batch loads (avoids rebuilding the map per data change)
  const hasFittedRef = useRef(false);
  useEffect(() => {
    if (facilities.length === 0 || hasFittedRef.current) return;
    hasFittedRef.current = true;
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
        fitAllFacilities();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [facilities]);

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
      const streetLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
        keepBuffer: 4,
      });
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
      const width = isSelected ? 34 : 26;
      const height = isSelected ? 44 : 35;

      const markerHtml = `
        <div class="netram-pin-wrap" onclick="window.__netram_select_facility && window.__netram_select_facility('${f.id}')" style="
          position: relative;
          width: ${width}px;
          height: ${height}px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          pointer-events: auto;
        ">
          ${
            isSelected
              ? `<div style="
                  position: absolute;
                  bottom: -4px;
                  left: 50%;
                  transform: translateX(-50%);
                  width: 20px;
                  height: 9px;
                  border-radius: 50%;
                  border: 2px solid ${color};
                  opacity: 0.85;
                  animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
                "></div>
                <div style="
                  position: absolute;
                  bottom: -2px;
                  left: 50%;
                  transform: translateX(-50%);
                  width: 12px;
                  height: 5px;
                  border-radius: 50%;
                  background: rgba(0, 0, 0, 0.35);
                "></div>`
              : `<div style="
                  position: absolute;
                  bottom: -2px;
                  left: 50%;
                  transform: translateX(-50%);
                  width: 10px;
                  height: 4px;
                  border-radius: 50%;
                  background: rgba(0, 0, 0, 0.22);
                "></div>`
          }
          <svg
            viewBox="0 0 28 38"
            width="${width}"
            height="${height}"
            style="display: block; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M14 0C6.27 0 0 6.27 0 14C0 24.5 10.5 33.5 14 38C17.5 33.5 28 24.5 28 14C28 6.27 21.73 0 14 0Z"
              fill="${color}"
              stroke="#ffffff"
              stroke-width="1.5"
              stroke-linejoin="round"
            />
            <circle cx="14" cy="14" r="5" fill="#ffffff"/>
            ${
              f.type === "authority_project"
                ? `<polygon points="14,10.5 15.2,13 17.8,13.3 15.9,15.1 16.4,17.7 14,16.4 11.6,17.7 12.1,15.1 10.2,13.3 12.8,13" fill="${color}"/>`
                : `<circle cx="14" cy="14" r="2.3" fill="${color}"/>`
            }
          </svg>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: "leaflet-facility-marker",
        iconSize: [width, height],
        iconAnchor: [width / 2, height],
        popupAnchor: [0, -height],
      });

      const marker = L.marker([f.lat, f.lng], { icon: customIcon });

      // Click on the location dot: open details panel on left and focus on right (Google Maps style)
      marker.on("click", (e: L.LeafletMouseEvent) => {
        if (geofenceModeRef.current === "polygon") {
          const { lat, lng } = e.latlng;
          setPolygonVertices((prev) => [...prev, [lat, lng]]);
          return;
        }
        if (geofenceModeRef.current === "location") {
          const { lat, lng } = e.latlng;
          setDraftLocation({ lat, lng });
          setLatInput(lat.toFixed(6));
          setLngInput(lng.toFixed(6));
          return;
        }
        L.DomEvent.stopPropagation(e);
        handleSelectFacility(f);
      });

      // Google Maps style: show label permanently when zoomed in (zoom >= 10) OR if facility is selected.
      // When zoomed out (< 10), unselected markers hide their label to prevent clutter, but show on hover!
      const showLabelPermanent = isZoomedIn || isSelected;

      // Location label directly visible on the map (Clickable like Google Maps)
      const shortName = f.name.length > 34 ? `${f.name.substring(0, 32)}…` : f.name;
      marker.bindTooltip(
        `<div class="netram-map-label ${isSelected ? "selected" : ""}" data-id="${f.id}" onclick="window.__netram_select_facility && window.__netram_select_facility('${f.id}')">
          <span class="label-name" title="${f.name}">${shortName}</span>
        </div>`,
        {
          permanent: showLabelPermanent,
          direction: "bottom",
          offset: [0, 8],
          className: `netram-leaflet-tooltip ${isSelected ? "selected" : ""}`,
          interactive: true,
        },
      );

      const tooltip = marker.getTooltip();
      if (tooltip) {
        tooltip.on("click", (e: L.LeafletMouseEvent) => {
          if (geofenceModeRef.current === "polygon") {
            const { lat, lng } = e.latlng;
            setPolygonVertices((prev) => [...prev, [lat, lng]]);
            return;
          }
          if (geofenceModeRef.current === "location") {
            const { lat, lng } = e.latlng;
            setDraftLocation({ lat, lng });
            setLatInput(lat.toFixed(6));
            setLngInput(lng.toFixed(6));
            return;
          }
          L.DomEvent.stopPropagation(e);
          handleSelectFacility(f);
        });
      }

      marker.addTo(markersGroup);
    });
  }, [visibleFacilities, selectedFacility, handleSelectFacility, isZoomedIn]);

  // Render Geofences
  useEffect(() => {
    if (!mapInstanceRef.current || !geofenceLayerRef.current) return;
    const geofenceGroup = geofenceLayerRef.current;
    geofenceGroup.clearLayers();

    if (!selectedFacility) return;

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
  }, [
    selectedFacility,
    geofenceMode,
    circleRadius,
    polygonVertices,
    currentGeofence,
    draftLocation,
  ]);

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
    setToastMessage(
      serverGeofence
        ? `Geofence saved for ${selectedFacility.name}`
        : `Geofence saved locally for ${selectedFacility.name}`,
    );
    setTimeout(() => setToastMessage(null), 3000);
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

  const handleGoToCoordinates = () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setToastMessage("Enter valid latitude (-90 to 90) and longitude (-180 to 180).");
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    setDraftLocation({ lat, lng });
    focusFacility(lat, lng, false);
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

  const resetGeofenceState = useCallback(() => {
    setGeofenceMode("view");
    setPolygonVertices([]);
    setDraftLocation(null);
  }, []);

  const handleBackToAllProjects = useCallback(() => {
    setSelectedProjectId(null);
    resetGeofenceState();
  }, [resetGeofenceState]);

  const handleClosePanel = useCallback(() => {
    setShowDrawer(false);
    resetGeofenceState();
  }, [resetGeofenceState]);

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

      {/* 2. Floating Re-open Button (Top-Left) — panel shrinks into / grows out of it */}
      {!showDrawer && (
        <button
          type="button"
          className="map-reopen-btn"
          onClick={() => {
            setShowDrawer(true);
            if (selectedFacility) {
              focusFacility(selectedFacility.lat, selectedFacility.lng, true);
            }
          }}
          style={{
            position: "absolute",
            top: "1rem",
            left: "1rem",
            zIndex: 1000,
            background: "rgba(255, 255, 255, 0.98)",
            backdropFilter: "blur(10px)",
            color: "var(--color-navy-brand)",
            borderRadius: "8px",
            border: "1px solid rgba(0, 26, 56, 0.15)",
            boxShadow: "0 4px 14px rgba(12, 42, 82, 0.12)",
            padding: "0.45rem 0.85rem",
            fontSize: "0.78rem",
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.45rem",
            transition: "all 0.15s ease",
          }}
          title={selectedFacility ? "View project details" : "View projects"}
        >
          <IconMapPin width={14} height={14} style={{ color: "#2563eb" }} />
          <span>View Projects</span>
        </button>
      )}

      {/* 3. Top-Right Cartographic Controls */}
      <div
        style={{
          position: "absolute",
          top: "1rem",
          right: "1rem",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
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

        {/* Zoom Out All Locations Button */}
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
            padding: "0.32rem 0.65rem",
            fontSize: "0.74rem",
            fontWeight: 600,
            color: "var(--text-primary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            transition: "all 0.15s ease",
          }}
        >
          <span>↺</span>
          <span>Zoom to All</span>
        </button>
      </div>

      {/* 4. Bottom-Right 2 x 3 Navigation & Zoom Controls Grid */}
      <div
        style={{
          position: "absolute",
          bottom: "1rem",
          right: "1rem",
          zIndex: 1000,
          display: "grid",
          gridTemplateColumns: "repeat(3, 34px)",
          gridTemplateRows: "repeat(2, 34px)",
          gap: "4px",
          userSelect: "none",
        }}
        aria-label="Map navigation and zoom controls"
      >
        {/* Row 1: [Left] [Right] [Zoom In] */}
        <button
          type="button"
          onClick={() => panMap(-180, 0)}
          className="netram-nav-btn"
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "6px",
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#0f172a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.15)",
          }}
          title="Pan Left (West)"
          aria-label="Pan Left"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            stroke="currentColor"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => panMap(180, 0)}
          className="netram-nav-btn"
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "6px",
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#0f172a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.15)",
          }}
          title="Pan Right (East)"
          aria-label="Pan Right"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            stroke="currentColor"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <button
          type="button"
          onClick={handleZoomIn}
          className="netram-nav-btn"
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "6px",
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#0f172a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.15)",
          }}
          title="Zoom In"
          aria-label="Zoom In"
        >
          <svg
            viewBox="0 0 24 24"
            width="15"
            height="15"
            stroke="currentColor"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        {/* Row 2: [Up] [Down] [Zoom Out] */}
        <button
          type="button"
          onClick={() => panMap(0, -180)}
          className="netram-nav-btn"
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "6px",
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#0f172a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.15)",
          }}
          title="Pan Up (North)"
          aria-label="Pan Up"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            stroke="currentColor"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => panMap(0, 180)}
          className="netram-nav-btn"
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "6px",
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#0f172a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.15)",
          }}
          title="Pan Down (South)"
          aria-label="Pan Down"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            stroke="currentColor"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        <button
          type="button"
          onClick={handleZoomOut}
          className="netram-nav-btn"
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "6px",
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#0f172a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.15)",
          }}
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <svg
            viewBox="0 0 24 24"
            width="15"
            height="15"
            stroke="currentColor"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* 5. Bottom-Left Legend (Smoothly glides right when drawer is open) */}
      <div
        style={{
          position: "absolute",
          bottom: "1rem",
          left: showDrawer ? "405px" : "1rem",
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
          transition: "left 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <span>Active</span>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span>Pending</span>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span>Draft</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "2px",
              border: "1px solid #16a34a",
              background: "rgba(34, 197, 94, 0.25)",
              display: "inline-block",
            }}
          />
          <span>Geofence</span>
        </div>
      </div>

      {/* 5. Bottom Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "absolute",
            bottom: "1.5rem",
            left: showDrawer ? "calc(50% + 190px)" : "50%",
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
            transition: "left 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <IconCheck width={14} height={14} style={{ color: "#22c55e" }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 7. Google Maps-style Facility Details Panel (Left-side) */}
      <div
        style={{
          position: "absolute",
          top: "0.75rem",
          left: "0.75rem",
          bottom: "0.75rem",
          width: "380px",
          maxWidth: "calc(100% - 1.5rem)",
          background: "rgba(255, 255, 255, 0.98)",
          backdropFilter: "blur(14px)",
          border: "1px solid rgba(0, 26, 56, 0.14)",
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(12, 42, 82, 0.16), 0 2px 8px rgba(0, 0, 0, 0.08)",
          zIndex: 1001,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transformOrigin: "135px 38px",
          transform: showDrawer ? "scale(1)" : "scale(0.04)",
          opacity: showDrawer ? 1 : 0,
          visibility: showDrawer ? ("visible" as const) : ("hidden" as const),
          pointerEvents: showDrawer ? ("auto" as const) : ("none" as const),
          willChange: "transform, opacity",
          transition: showDrawer
            ? "transform 0.34s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.26s ease, visibility 0s"
            : "transform 0.28s cubic-bezier(0.4, 0, 0.68, 0.18), opacity 0.2s ease, visibility 0s linear 0.28s",
        }}
      >
        {selectedFacility ? (
          <>
            {/* Top Navigation Bar / Facility Details Header */}
            <div
              style={{
                padding: "0.45rem 0.5rem 0.45rem 0.65rem",
                background: "#f8fafc",
                borderBottom: "1px solid var(--color-border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.4rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", minWidth: 0 }}>
                <button
                  type="button"
                  onClick={handleBackToAllProjects}
                  title="Back to all projects"
                  style={{
                    border: "none",
                    background: "transparent",
                    borderRadius: "6px",
                    padding: "0.25rem 0.45rem 0.25rem 0.3rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.2rem",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    flexShrink: 0,
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#e2e8f0";
                    e.currentTarget.style.color = "var(--color-navy-brand)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-muted)";
                  }}
                >
                  <IconChevronLeft width={13} height={13} />
                  <span>Back</span>
                </button>
              </div>
              <button
                type="button"
                onClick={handleClosePanel}
                className="map-panel-close"
                aria-label="Close panel"
                title="Close panel (Esc)"
              >
                <IconX width={14} height={14} style={{ strokeWidth: 2.5 }} />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div
              style={{
                padding: "1rem 1.1rem",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                flex: 1,
              }}
            >
              {/* Project Overview (shared with the cards view) */}
              <ProjectOverviewCard project={selectedFacility} />

              {/* Geofence Perimeter Controls & Action Row */}
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
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
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
                      onClick={handleGoToCoordinates}
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
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
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

                  {/* Presets Row */}
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
                          border:
                            circleRadius === preset ? "1px solid #2563eb" : "1px solid #cbd5e1",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        {preset}m
                      </button>
                    ))}
                  </div>

                  {/* Range Slider */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      type="range"
                      min={50}
                      max={1000}
                      step={25}
                      value={circleRadius}
                      onChange={(e) => setCircleRadius(parseInt(e.target.value, 10))}
                      style={{
                        flex: 1,
                        accentColor: "#2563eb",
                        cursor: "pointer",
                      }}
                    />
                  </div>

                  {/* Action Buttons */}
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
                      onClick={handleSealGeofence}
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
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
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
                    Click anywhere on the map around the facility to place perimeter boundary
                    points.
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
                      onClick={handleSealGeofence}
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
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#94a3b8";
                      e.currentTarget.style.background = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#cbd5e1";
                      e.currentTarget.style.background = "#ffffff";
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      width={13}
                      height={13}
                    >
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
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#94a3b8";
                      e.currentTarget.style.background = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#cbd5e1";
                      e.currentTarget.style.background = "#ffffff";
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      width={13}
                      height={13}
                    >
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
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#94a3b8";
                      e.currentTarget.style.background = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#cbd5e1";
                      e.currentTarget.style.background = "#ffffff";
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
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {/* Supervising Authority (icon-labelled) */}
                <div
                  style={{
                    display: "flex",
                    gap: "0.55rem",
                    alignItems: "center",
                    minWidth: 0,
                  }}
                  title="Supervising Authority"
                >
                  <IconShieldCheck
                    width={14}
                    height={14}
                    style={{ color: "var(--text-subtle)", flexShrink: 0 }}
                  />
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
                    {getAuthorityName(selectedFacility.authorityId)}
                  </span>
                </div>

              </div>

              {/* Bottom Primary Action Button */}
              <div style={{ marginTop: "auto", paddingTop: "0.5rem" }}>
                <Link
                  href={`/projects/${selectedFacility.id}`}
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
            </div>
          </>
        ) : (
          <>
            {/* Projects List Header — compact */}
            <div
              style={{
                padding: "0.45rem 0.5rem 0.45rem 0.65rem",
                background: "#f8fafc",
                borderBottom: "1px solid var(--color-border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.4rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", minWidth: 0 }}>
                <IconMapPin width={13} height={13} style={{ color: "#2563eb", flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--text-muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Projects
                </span>
              </div>
              <button
                type="button"
                onClick={handleClosePanel}
                className="map-panel-close"
                aria-label="Close panel"
                title="Close panel (Esc)"
              >
                <IconX width={13} height={13} style={{ strokeWidth: 2.5 }} />
              </button>
            </div>

            {/* Scrollable Project Cards List */}
            <div
              style={{
                padding: "0.75rem",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "0.55rem",
                flex: 1,
              }}
            >
              {visibleFacilities.length === 0 ? (
                <div
                  style={{
                    padding: "2rem 1rem",
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: "0.8rem",
                  }}
                >
                  <p style={{ margin: "0", fontWeight: 600 }}>No registered projects available.</p>
                </div>
              ) : (
                visibleFacilities.map((f) => {
                  const distName = getDistrictName(f.districtId, f.code);
                  return (
                    <div
                      key={f.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectFacility(f)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSelectFacility(f);
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
                      {/* Row 1: name + status */}
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
                          <StatusBadge status={f.status} />
                        </div>
                      </div>

                      {/* Row 2: code · district … chevron, one muted line */}
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
                          title={distName}
                        >
                          <IconMapPin width={11} height={11} style={{ color: "var(--text-subtle)", flexShrink: 0 }} />
                          {distName}
                        </span>
                        <span style={{ flex: 1 }} />
                        <span
                          title="Open facility dossier"
                          style={{ color: "#2563eb", display: "inline-flex", flexShrink: 0 }}
                        >
                          <IconChevronRight width={13} height={13} />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
