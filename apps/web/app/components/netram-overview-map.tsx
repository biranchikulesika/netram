"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { IconMapPin, IconChevronLeft, IconCheck, IconX } from "../components/icons";

export interface MapFacility {
  id: string;
  name: string;
  code: string;
  districtId: string | null;
  description: string | null;
  lat: number;
  lng: number;
  color: string;
  districtLabel: string;
  /** Optional pin glyph: "star" for authority projects, dot otherwise. */
  pinGlyph?: "star" | "dot";
}

export interface LegendItem {
  label: string;
  /** Solid square swatch (e.g. geofence). */
  swatch?: string;
  /** Renders a small colored pin instead of a square. */
  pinColor?: string;
}

export interface NetramOverviewMapHandle {
  pushToast(message: string): void;
}

export interface NetramOverviewMapProps {
  facilities: MapFacility[];
  legend: LegendItem[];
  listTitle: string;
  emptyText: string;
  reopenLabel: string;
  backLabel: string;
  renderBrowseRow?: (f: MapFacility, select: (f: MapFacility) => void) => React.ReactNode;
  renderDrawerContent?: (f: MapFacility) => React.ReactNode;
  onSelectChange?: (id: string | null) => void;
  /** Map clicks (including marker clicks while drawing) are forwarded here for drawing modes. */
  onMapClick?: (latlng: { lat: number; lng: number }) => void;
  isDrawing?: boolean;
  cursor?: string;
  /** Called once after the Leaflet map + overlay layer group are initialized (for custom overlays such as geofences). */
  onMapReady?: (api: { map: L.Map; overlay: L.LayerGroup }) => void;
  /** Imperative handle for non-React consumers (e.g. toasts). */
  mapRef?: Ref<NetramOverviewMapHandle> | null;
}

const ZOOM_LABEL_THRESHOLD = 10;

/**
 * Shared Google Maps-style registry map used by both the projects registry and
 * the corrective-actions registry. Owns all cartographic chrome (layer
 * switcher, nav/zoom controls, left details drawer, legend, markers) and is
 * data-agnostic: callers supply facility pins, a detail renderer for the
 * drawer, and optional map-click passthrough for drawing modes (geofences).
 */
const NetramOverviewMap = function NetramOverviewMap({
    facilities,
    legend,
    listTitle,
    emptyText,
    reopenLabel,
    backLabel,
    renderBrowseRow,
    renderDrawerContent,
    onSelectChange,
    onMapClick,
    isDrawing = false,
    cursor,
    onMapReady,
    mapRef,
  }: NetramOverviewMapProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markersGroupRef = useRef<L.LayerGroup | null>(null);
    const overlayGroupRef = useRef<L.LayerGroup | null>(null);
    const tileLayerRef = useRef<L.TileLayer | null>(null);

    const [mapType, setMapType] = useState<"streets" | "satellite">("streets");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showDrawer, setShowDrawer] = useState<boolean>(true);
    const [isZoomedIn, setIsZoomedIn] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const selectedFacility = useMemo(() => {
      if (!selectedId) return null;
      return facilities.find((f) => f.id === selectedId) ?? null;
    }, [facilities, selectedId]);

    useImperativeHandle(mapRef, () => ({
      pushToast(message: string) {
        setToastMessage(message);
        window.setTimeout(() => setToastMessage(null), 3000);
      },
    }));

    const fitAllFacilities = useCallback(() => {
      if (!mapInstanceRef.current || facilities.length === 0) return;
      const coords = facilities
        .filter((f) => f.lat && f.lng)
        .map((f) => [f.lat, f.lng] as [number, number]);

      if (coords.length > 0) {
        const bounds = L.latLngBounds(coords);
        mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 });
      } else {
        mapInstanceRef.current.setView([20.4, 84.8], 7);
      }
    }, [facilities]);

    const focusFacility = useCallback((lat: number, lng: number, withOffset = true) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      const maxZoom = map.getMaxZoom() || 18;
      const targetZoom = Math.max(map.getZoom(), maxZoom);

      const containerWidth =
        mapContainerRef.current?.clientWidth ??
        (typeof window !== "undefined" ? window.innerWidth : 1000);
      const isDesktop = containerWidth >= 768;

      const zoomDelta = Math.abs(targetZoom - map.getZoom());
      const duration = Math.min(2.2, 0.55 + zoomDelta * 0.11);

      if (withOffset && isDesktop) {
        const panelWidth = 380;
        const targetPoint = map.project([lat, lng], targetZoom);
        const offsetPoint = L.point(targetPoint.x - panelWidth / 2, targetPoint.y);
        const newCenter = map.unproject(offsetPoint, targetZoom);
        map.flyTo(newCenter, targetZoom, { duration, easeLinearity: 0.18 });
      } else {
        map.flyTo([lat, lng], targetZoom, { duration, easeLinearity: 0.18 });
      }
    }, []);

    const panMap = useCallback((dx: number, dy: number) => {
      if (!mapInstanceRef.current) return;
      mapInstanceRef.current.panBy([dx, dy], { animate: true, duration: 0.25 });
    }, []);

    const handleZoomIn = useCallback(() => {
      if (!mapInstanceRef.current) return;
      mapInstanceRef.current.zoomIn();
    }, []);

    const handleZoomOut = useCallback(() => {
      if (!mapInstanceRef.current) return;
      mapInstanceRef.current.zoomOut();
    }, []);

    const handleSelectFacility = useCallback(
      (f: MapFacility) => {
        setSelectedId(f.id);
        setShowDrawer(true);
        onSelectChange?.(f.id);
        focusFacility(f.lat, f.lng, true);
      },
      [focusFacility, onSelectChange],
    );

    const handleBackToAll = useCallback(() => {
      setSelectedId(null);
      onSelectChange?.(null);
    }, [onSelectChange]);

    const handleClosePanel = useCallback(() => {
      setShowDrawer(false);
    }, []);

    // Expose selection + focus on window for popup/DOM button interactions
    useEffect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__netram_select_facility = (id: string) => {
        const facility = facilities.find((f) => f.id === id);
        if (facility) handleSelectFacility(facility);
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__netram_open_record = (id: string) => {
        const facility = facilities.find((f) => f.id === id);
        if (facility) handleSelectFacility(facility);
      };
      return () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (window as any).__netram_select_facility;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (window as any).__netram_open_record;
      };
    }, [facilities, handleSelectFacility]);

    // Invalidate map size when drawer toggles to avoid tile clipping
    useEffect(() => {
      const timer = setTimeout(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      }, 280);
      return () => clearTimeout(timer);
    }, [showDrawer]);

    useEffect(() => {
      const handleResize = () => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
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

        const streetLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
          keepBuffer: 4,
        });
        streetLayer.addTo(map);
        tileLayerRef.current = streetLayer;

        const markersGroup = L.layerGroup().addTo(map);
        const overlayGroup = L.layerGroup().addTo(map);

        markersGroupRef.current = markersGroup;
        overlayGroupRef.current = overlayGroup;
        mapInstanceRef.current = map;

        onMapReady?.({ map, overlay: overlayGroup });

        setTimeout(() => {
          if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
        }, 150);

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
          onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
        });
      }

      return () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      };
    }, []);

    // Fit all facilities once the first batch loads
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

      facilities.forEach((f) => {
        const isSelected = selectedFacility?.id === f.id;
        const color = f.color;
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
                f.pinGlyph === "star"
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

        marker.on("click", (e: L.LeafletMouseEvent) => {
          if (isDrawing) {
            onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
            return;
          }
          L.DomEvent.stopPropagation(e);
          handleSelectFacility(f);
        });

        const showLabelPermanent = isZoomedIn || isSelected;
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
            if (isDrawing) {
              onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
              return;
            }
            L.DomEvent.stopPropagation(e);
            handleSelectFacility(f);
          });
        }

        marker.addTo(markersGroup);
      });
    }, [facilities, selectedFacility, handleSelectFacility, isZoomedIn, isDrawing, onMapClick]);

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
        <div
          ref={mapContainerRef}
          style={{ width: "100%", height: "100%", zIndex: 1, cursor }}
        />

        {/* 2. Floating Re-open Button (Top-Left) */}
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
            title={selectedFacility ? reopenLabel : listTitle}
          >
            <IconMapPin width={14} height={14} style={{ color: "#2563eb" }} />
            <span>View {reopenLabel}</span>
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
            title="Zoom out to show all locations"
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
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
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
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
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
            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
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
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
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
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
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
            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        {/* 5. Bottom-Left Legend */}
        {legend.length > 0 && (
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
            {legend.map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                {item.swatch ? (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "2px",
                      border: `1px solid ${item.swatch}`,
                      background: "rgba(34, 197, 94, 0.25)",
                      display: "inline-block",
                    }}
                  />
                ) : item.pinColor ? (
                  <span
                    style={{
                      width: 8,
                      height: 12,
                      borderRadius: "6px 6px 2px 2px",
                      background: item.pinColor,
                      display: "inline-block",
                    }}
                  />
                ) : null}
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* 6. Bottom Toast Notification */}
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

        {/* 7. Google Maps-style Details Panel (Left-side) */}
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
                    onClick={handleBackToAll}
                    title={backLabel}
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
                {renderDrawerContent ? renderDrawerContent(selectedFacility) : null}
              </div>
            </>
          ) : (
            <>
              {/* List Header — compact */}
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
                    {listTitle}
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

              {/* Scrollable Browse List */}
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
                {facilities.length === 0 ? (
                  <div
                    style={{
                      padding: "2rem 1rem",
                      textAlign: "center",
                      color: "var(--text-muted)",
                      fontSize: "0.8rem",
                    }}
                  >
                    <p style={{ margin: "0", fontWeight: 600 }}>{emptyText}</p>
                  </div>
                ) : renderBrowseRow ? (
                  facilities.map((f) => (
                    <div key={f.id}>{renderBrowseRow(f, handleSelectFacility)}</div>
                  ))
                ) : (
                  facilities.map((f) => (
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
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.45rem",
                          minWidth: 0,
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 14,
                            borderRadius: "5px 5px 2px 2px",
                            background: f.color,
                            flexShrink: 0,
                          }}
                        />
                        <span
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
                        </span>
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
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                          title={`Identifier: ${f.code}`}
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
                        <span title="Open details" style={{ color: "#2563eb", display: "inline-flex", flexShrink: 0 }}>
                          <IconChevronLeft width={13} height={13} style={{ transform: "rotate(180deg)" }} />
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
};

export default NetramOverviewMap;