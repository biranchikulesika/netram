/**
 * app/check-in.tsx - Field Site Map
 *
 * Full-screen map for navigating to assigned inspection sites:
 *   • Full-bleed Leaflet map rendering every assigned site; zooming out
 *     reveals the whole set. The selected site is a large teardrop pin with
 *     its name; the rest are small tappable dots. Tapping a dot selects it.
 *   • Two bare icon controls top-right: map style and focus-on-my-location
 *   • One frameless bottom card for the selected site with live GPS distance
 *
 * Location is advisory: it drives only the distance readout. Pin positions
 * are GPS-free so GPS ticks never reload the map or reset the user's zoom.
 * Location is not an access control and no boundary is drawn.
 */
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import { colors } from "../src/theme/colors";
import { useSettings } from "../src/theme/settings-context";
import { OfflineInspectionQueue, type CachedInspectionRecord } from "../src/offline/queue";
import { Icon } from "../src/components/ui/Icon";
import { useAuth } from "../src/auth/auth-context";
import type { ProjectGeofence } from "@netram/types";
import { NetramButton } from "../src/components/ui/NetramButton";
import { formatInspectionType } from "../src/utils/formatters";
import { WebView } from "react-native-webview";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const f1 = (lat1 * Math.PI) / 180;
  const f2 = (lat2 * Math.PI) / 180;
  const df = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function fmtDistance(m: number | null): string {
  if (m === null) return "–";
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${m} m`;
}

// The map renders only sites whose project has a server-provided geofence.
// No synthetic coordinates are fabricated client-side (AGENTS.md §34, §64).

interface MapSite {
  id: string;
  projectCode: string;
  projectName: string;
  status: string;
  type: string;
  districtId: string | null;
  lat: number;
  lng: number;
  distanceMeters: number | null;
}

const queue = new OfflineInspectionQueue();

// ---------------------------------------------------------------------------
// Leaflet HTML - injected into iframe / WebView
// ---------------------------------------------------------------------------

function buildLeafletHtml(params: {
  sites: MapSite[];
  selectedId: string;
  centerLat: number;
  centerLng: number;
  zoom: number;
  mapType?: "street" | "satellite";
  isDark?: boolean;
}): string {
  const {
    sites,
    selectedId,
    centerLat,
    centerLng,
    zoom,
    mapType = "street",
    isDark = false,
  } = params;

  // `<` is escaped so a value can never close the <script> block it lives in
  const sitesJson = JSON.stringify(sites).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    html,body,#map{width:100%;height:100%;background:${isDark ? "#090d16" : "#f6f8fc"};font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}


    /* Focused site pin - teardrop, white ring, status-coloured */
    .site-pin{
      width:40px;height:40px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      background:#fff;
      box-shadow:0 2px 6px rgba(0,36,73,.22),0 6px 16px rgba(0,36,73,.18);
    }
    .pin-fill{position:absolute;inset:3px;border-radius:50% 50% 50% 0}
    .pin-default{background:linear-gradient(145deg,#0b3a6b,#002449)}
    .pin-progress{background:linear-gradient(145deg,#16a34a,#15803d)}
    .pin-special{background:linear-gradient(145deg,#ea580c,#c2410c)}

    /* Unfocused sites: small dots, 36px touch target */
    .site-dot-box{display:flex;align-items:center;justify-content:center;width:36px;height:36px;cursor:pointer}
    .site-dot{width:16px;height:16px;border-radius:50%;border:3px solid #fff;
      box-shadow:0 1px 4px rgba(0,36,73,.4)}

    /* Project name: wide wrap box, outlined text (no pill) */
    .label-slot{
      position:absolute;left:0;top:14px;width:260px;
      text-align:center;pointer-events:none;
    }
    .site-label{
      display:inline-block;max-width:260px;overflow-wrap:break-word;
      color:#fff;font-size:11.5px;font-weight:700;line-height:1.4;
      text-shadow:
        1px 1px 0 #002449, 1px -1px 0 #002449, -1px 1px 0 #002449, -1px -1px 0 #002449,
        0 1px 0 #002449, 0 -1px 0 #002449, 1px 0 0 #002449, -1px 0 0 #002449,
        0 2px 5px rgba(0,36,73,.55);
    }

    /* Inspector position: small blue dot with white ring */
    .user-dot{width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid #fff;
      box-shadow:0 1px 5px rgba(0,36,73,.45)}

    /* Attribution is noise here - keep the map clean */
    .leaflet-control-attribution{display:none}
  </style>
</head>
<body>
<div id="map"></div>

<script>
  const SITES = ${sitesJson};
  let SELECTED_ID = "${selectedId}";
  const IS_DARK = ${isDark ? "true" : "false"};

  // Site fields come from the API and land in raw HTML - escape once, here.
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const map = L.map('map', {zoomControl: false, attributionControl: false})
    .setView([${centerLat}, ${centerLng}], ${zoom});

  // Base tile layers: CartoDB Dark Matter for dark mode, OpenStreetMap for light mode
  const streetLayer = IS_DARK
    ? L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: 'CartoDB Dark Matter'
      })
    : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: 'OpenStreetMap'
      });

  const satImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Esri World Imagery'
  });

  const satLabels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19
  });

  const satelliteLayer = L.layerGroup([satImagery, satLabels]);

  let currentMapType = "${mapType}";
  if (currentMapType === 'satellite') {
    satelliteLayer.addTo(map);
  } else {
    streetLayer.addTo(map);
  }

  window.switchLayer = function(type) {
    if (type === currentMapType) return;
    currentMapType = type;
    if (type === 'satellite') {
      map.removeLayer(streetLayer);
      satelliteLayer.addTo(map);
    } else {
      map.removeLayer(satelliteLayer);
      streetLayer.addTo(map);
    }
    const msg = JSON.stringify({type: 'MAP_TYPE_CHANGED', mapType: type});
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(msg);
    } else {
      window.parent.postMessage(msg, '*');
    }
  };

  window.switchSite = function(siteId) {
    if (SELECTED_ID === siteId) return;
    SELECTED_ID = siteId;
    const msg = JSON.stringify({type:'SELECT_SITE', siteId: siteId});
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(msg);
    } else {
      window.parent.postMessage(msg, '*');
    }
  };

  // Inspector position marker: created on first focus, moved on later ones.
  let userMarker = null;
  const userIcon = L.divIcon({
    className: '',
    html: '<div class="user-dot"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  window.focusUser = function(lat, lng) {
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    if (userMarker) {
      userMarker.setLatLng([lat, lng]);
    } else {
      userMarker = L.marker([lat, lng], {icon: userIcon, zIndexOffset: 1000}).addTo(map);
    }
    map.setView([lat, lng], 16);
  };

  // Cross-platform message listener
  function handleIncoming(data) {
    if (!data) return;
    if (data.type === 'SET_MAP_TYPE' && (data.mapType === 'street' || data.mapType === 'satellite')) {
      window.switchLayer(data.mapType);
    }
    if (data.type === 'FOCUS_USER') {
      window.focusUser(data.lat, data.lng);
    }
  }
  window.addEventListener('message', function(e) {
    try {
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      handleIncoming(data);
    } catch(err) {}
  });
  document.addEventListener('message', function(e) {
    try {
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      handleIncoming(data);
    } catch(err) {}
  });

  // Every site gets a marker so zooming out reveals the whole set.
  // The selected one is the big teardrop and carries the name label.
  SITES.forEach((site) => {
    const isSel = site.id === SELECTED_ID;
    const pinClass = (site.status === 'in_progress' || site.status === 'evidence_collection')
      ? 'pin-progress'
      : site.type === 'special' ? 'pin-special' : 'pin-default';

    L.marker([site.lat, site.lng], {
      icon: L.divIcon({
        className: '',
        html: isSel
          ? '<div class="site-pin"><div class="pin-fill ' + pinClass + '"></div></div>'
          : '<div class="site-dot-box"><div class="site-dot ' + pinClass + '"></div></div>',
        iconSize: isSel ? [40, 40] : [36, 36],
        iconAnchor: isSel ? [20, 40] : [18, 18],
        popupAnchor: [0, -40]
      })
    }).on('click', function() { window.switchSite(site.id); }).addTo(map);

    if (!isSel) return;

    // 260px box = the width the name wraps into; anchor [130,0] centres it
    L.marker([site.lat, site.lng], {
      icon: L.divIcon({
        className: '',
        html: '<div class="label-slot"><div class="site-label">' + esc(site.projectName) + '</div></div>',
        iconSize: [260, 64],
        iconAnchor: [130, 0]
      }),
      interactive: false,
      zIndexOffset: -1
    }).addTo(map);
  });

  // Land focused on the selected site; every other site is still on the map,
  // so pinching out brings the whole set into frame.
  if (SELECTED_ID) {
    const selSite = SITES.find(s => s.id === SELECTED_ID);
    if (selSite) map.setView([selSite.lat, selSite.lng], ${zoom});
  }
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Main screen component
// ---------------------------------------------------------------------------

export default function MapScreen() {
  const router = useRouter();
  const { client } = useAuth();
  const { theme, isPureDark } = useSettings();
  const params = useLocalSearchParams<{ inspectionId?: string }>();

  const [loading, setLoading] = useState(true);
  const [cachedInspections, setCachedInspections] = useState<CachedInspectionRecord[]>([]);
  const [remoteGeofences, setRemoteGeofences] = useState<ProjectGeofence[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(params.inspectionId ?? null);
  const [mapType, setMapType] = useState<"street" | "satellite">("street");

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const webViewRef = useRef<WebView | null>(null);

  // GPS
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
    acquiredAt: number;
  } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"loading" | "denied" | "ready" | "error">(
    "loading",
  );
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadData = useCallback(async () => {
    try {
      const local = await queue.getCachedInspections();
      setCachedInspections(local);

      if (client) {
        const [inspRes, geoRes] = await Promise.allSettled([
          client.listInspections({ pageSize: 50 }),
          client.listProjectGeofences(),
        ]);
        if (inspRes.status === "fulfilled" && inspRes.value.items.length > 0) {
          await queue.cacheInspections(inspRes.value.items);
          setCachedInspections(await queue.getCachedInspections());
        }
        if (geoRes.status === "fulfilled") setRemoteGeofences(geoRes.value);
      }
    } catch {
      // offline - use cached data
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ---------------------------------------------------------------------------
  // GPS acquisition
  // ---------------------------------------------------------------------------

  // Acquires a fresh GPS fix, updates state, and returns the fix so callers
  // (e.g. focus-my-location) can act on the new coordinates immediately.
  const acquireLocation = useCallback(async (): Promise<{
    latitude: number;
    longitude: number;
  } | null> => {
    try {
      setLocationStatus("loading");
      const perm = await Location.getForegroundPermissionsAsync();
      const granted = perm.granted
        ? true
        : (await Location.requestForegroundPermissionsAsync()).granted;

      if (!granted) {
        setLocationStatus("denied");
        return null;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        acquiredAt: Date.now(),
      });
      setLocationStatus("ready");
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch {
      setLocationStatus("error");
      return null;
    }
  }, []);

  useEffect(() => {
    void acquireLocation();
    locationIntervalRef.current = setInterval(() => {
      void acquireLocation();
    }, 10_000);
    return () => {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    };
  }, [acquireLocation]);

  // ---------------------------------------------------------------------------
  // Select from URL param
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (params.inspectionId) setSelectedId(params.inspectionId);
  }, [params.inspectionId]);

  // ---------------------------------------------------------------------------
  // Computed map sites
  // ---------------------------------------------------------------------------

  // Pin positions come exclusively from server geofences and are GPS-free on
  // purpose: the map HTML reloads whenever this list changes, and a reload
  // would snap the user's zoom back. Distances are derived separately below so
  // the bottom card still updates live. Sites without a geofenced project have
  // no trustworthy position and are omitted rather than placed synthetically.
  const mapSites = useMemo<MapSite[]>(() => {
    const geoMap = new Map<string, { lat: number; lng: number }>();
    remoteGeofences.forEach((g) => {
      if (g.centerLat !== null && g.centerLng !== null) {
        geoMap.set(g.projectId, { lat: g.centerLat, lng: g.centerLng });
      }
    });

    return cachedInspections.flatMap((insp) => {
      const geo = geoMap.get(insp.project_id);
      if (!geo) return [];
      return [
        {
          id: insp.id,
          projectCode: insp.project_code || insp.project_id,
          projectName: insp.project_name || "Inspection Site",
          status: insp.status || "assigned",
          type: insp.type || "routine",
          districtId: insp.district_id,
          lat: geo.lat,
          lng: geo.lng,
          distanceMeters: null,
        },
      ];
    });
  }, [cachedInspections, remoteGeofences]);

  // Live distance readouts for the bottom card - recomputed on every GPS tick
  // without touching the map HTML.
  const distanceById = useMemo(() => {
    const distances = new Map<string, number | null>();
    if (!location) return distances;
    const isFresh = Date.now() - (location.acquiredAt ?? 0) < 5 * 60 * 1000;
    if (!isFresh) return distances;
    for (const site of mapSites) {
      distances.set(
        site.id,
        haversineMeters(location.latitude, location.longitude, site.lat, site.lng),
      );
    }
    return distances;
  }, [location, mapSites]);

  // Auto-select first active site
  useEffect(() => {
    if (!selectedId && mapSites.length > 0) {
      const active =
        mapSites.find(
          (s) => s.status === "in_progress" || s.status === "assigned" || s.status === "scheduled",
        ) ?? mapSites[0];
      if (active) setSelectedId(active.id);
    }
  }, [selectedId, mapSites]);

  const selectedSite = useMemo(() => {
    const site = mapSites.find((s) => s.id === selectedId) ?? null;
    if (!site) return null;
    return { ...site, distanceMeters: distanceById.get(site.id) ?? null };
  }, [mapSites, selectedId, distanceById]);

  // ---------------------------------------------------------------------------
  // Map HTML & center coordinates
  // ---------------------------------------------------------------------------

  // The map HTML rebuilds only when the pins themselves change - never on a
  // GPS tick - so the user's zoom survives while the card distance refreshes.
  const selectedPin = useMemo(
    () => mapSites.find((s) => s.id === selectedId) ?? null,
    [mapSites, selectedId],
  );
  // No selection (or none mappable): frame the whole set of server-pinned
  // sites instead of defaulting to a hardcoded coordinate.
  const mapCenter = useMemo(() => {
    if (selectedPin) return { lat: selectedPin.lat, lng: selectedPin.lng };
    if (mapSites.length > 0) {
      const lats = mapSites.map((s) => s.lat);
      const lngs = mapSites.map((s) => s.lng);
      return {
        lat: (Math.min(...lats) + Math.max(...lats)) / 2,
        lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      };
    }
    return null;
  }, [selectedPin, mapSites]);

  const leafletHtml = useMemo(
    () =>
      // Without a mappable site there is no trustworthy centre: render a
      // blank slate and let the empty-state card explain why.
      mapCenter
        ? buildLeafletHtml({
            // All sites are rendered so zooming out brings the whole set into
            // frame. The selected one is the only one drawn as a large pin with
            // a name label; the rest are small tappable dots.
            sites: mapSites,
            selectedId: selectedSite?.id ?? "",
            centerLat: mapCenter.lat,
            centerLng: mapCenter.lng,
            // Land focused on the selected site; the empty state zooms out
            zoom: selectedPin ? 16 : 13,
            mapType,
            isDark: isPureDark,
          })
        : "",
    [mapSites, selectedPin, mapCenter, mapType, isPureDark],
  );

  // ---------------------------------------------------------------------------
  // Map message handling
  // ---------------------------------------------------------------------------

  const handleMapMessage = useCallback((raw: unknown) => {
    try {
      const d = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (d?.type === "SELECT_SITE" && d.siteId) {
        setSelectedId(d.siteId as string);
      }
      if (d?.type === "MAP_TYPE_CHANGED" && (d.mapType === "street" || d.mapType === "satellite")) {
        setMapType(d.mapType);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const handler = (e: MessageEvent) => {
        handleMapMessage(e.data);
      };
      window.addEventListener("message", handler);
      return () => window.removeEventListener("message", handler);
    }
    return undefined;
  }, [handleMapMessage]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  // Single channel for React → map commands, across iframe (web) and WebView.
  const postToMap = useCallback((msg: string) => {
    if (Platform.OS === "web" && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(msg, "*");
    } else if (webViewRef.current) {
      webViewRef.current.postMessage(msg);
    }
  }, []);

  const toggleMapType = () => {
    const nextType = mapType === "street" ? "satellite" : "street";
    setMapType(nextType);
    postToMap(JSON.stringify({ type: "SET_MAP_TYPE", mapType: nextType }));
  };

  // Focus the map on the inspector's current position: fetch a fresh GPS fix
  // and hand it to the map by message - the HTML itself stays GPS-free so the
  // user's zoom is never reset by a rebuild.
  const handleFocusMyLocation = useCallback(async () => {
    const fix = await acquireLocation();
    if (!fix) return;
    postToMap(JSON.stringify({ type: "FOCUS_USER", lat: fix.latitude, lng: fix.longitude }));
  }, [acquireLocation, postToMap]);

  const stepSite = (delta: number) => {
    if (mapSites.length === 0) return;
    const current = mapSites.findIndex((s) => s.id === selectedId);
    const next = (current + delta + mapSites.length) % mapSites.length;
    setSelectedId(mapSites[next]?.id ?? null);
  };

  const handleNavigate = () => {
    if (!selectedSite) return;
    const url =
      Platform.OS === "ios"
        ? `maps:0,0?q=${selectedSite.lat},${selectedSite.lng}`
        : `geo:${selectedSite.lat},${selectedSite.lng}?q=${selectedSite.lat},${selectedSite.lng}`;
    void Linking.openURL(url);
  };

  const handleOpenInspection = () => {
    if (!selectedSite) return;
    router.push({
      pathname: "/inspections/[id]",
      params: { id: selectedSite.id },
    });
  };

  // ---------------------------------------------------------------------------
  // Web map rendering
  // ---------------------------------------------------------------------------

  const renderWebIframe = () => {
    if (Platform.OS !== "web") return null;
    return React.createElement("iframe", {
      ref: iframeRef,
      srcDoc: leafletHtml,
      style: styles.iframe,
      title: "Field Map",
      sandbox: "allow-scripts allow-same-origin",
      allow: "geolocation",
    });
  };

  // ---------------------------------------------------------------------------
  // Statutory rationale view if location permission denied
  // ---------------------------------------------------------------------------

  if (locationStatus === "denied") {
    return (
      <View
        style={[
          styles.root,
          {
            backgroundColor: isPureDark ? "#090D16" : "#F6F8FC",
            padding: 24,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <View
          style={[
            styles.rationaleCard,
            {
              backgroundColor: isPureDark ? "#121824" : "#FFFFFF",
              borderColor: isPureDark ? "#27272A" : "#E2E8F0",
            },
          ]}
        >
          <View style={styles.rationaleHeader}>
            <Text style={[styles.rationaleTitle, { color: isPureDark ? "#FFFFFF" : "#002449" }]}>
              Location Access
            </Text>
          </View>

          <Text style={[styles.rationaleBody, { color: isPureDark ? "#A1A1AA" : "#475569" }]}>
            Netram uses your location to show where you are in relation to your assigned sites.
            Access is optional - the map works without it.
          </Text>

          <View
            style={[
              styles.rationaleNoteBox,
              {
                backgroundColor: isPureDark ? "#1E293B" : "#F8FAFC",
                borderColor: isPureDark ? "#27272A" : "#E2E8F0",
              },
            ]}
          >
            <Text style={[styles.rationaleNoteText, { color: isPureDark ? "#CBD5E1" : "#334155" }]}>
              • Shows your distance to each assigned site.{"\n"}• Lets you recentre the map on your
              position.{"\n"}• Evidence photos capture their own coordinates separately.
            </Text>
          </View>

          <View style={styles.rationaleBtnCol}>
            <NetramButton
              label="Grant Location Permission"
              variant="primary"
              onPress={() => {
                void acquireLocation();
              }}
              style={{ width: "100%", backgroundColor: isPureDark ? "#3B82F6" : "#002449" }}
            />
            <NetramButton
              label="Open System Settings"
              variant="secondary"
              onPress={() => {
                if (Platform.OS !== "web" && Linking.openSettings) {
                  void Linking.openSettings();
                } else {
                  void acquireLocation();
                }
              }}
              style={{ width: "100%", marginTop: 10 }}
            />
            <NetramButton
              label="Back to Assignments"
              variant="secondary"
              onPress={() => {
                router.back();
              }}
              style={{ width: "100%", marginTop: 8 }}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* ── 1. Map Layer (fills full screen) ─────────────────────────────────── */}
      <View style={styles.mapLayer}>
        {loading ? (
          <View style={styles.mapPlaceholder}>
            <ActivityIndicator size="large" color={colors.navyDark ?? "#002449"} />
            <Text style={styles.mapPlaceholderText}>Loading map…</Text>
          </View>
        ) : leafletHtml ? (
          Platform.OS === "web" ? (
            renderWebIframe()
          ) : (
            <WebView
              ref={webViewRef}
              originWhitelist={["*"]}
              source={{ html: leafletHtml }}
              style={styles.iframe}
              javaScriptEnabled
              domStorageEnabled
              geolocationEnabled
              onMessage={(event) => {
                handleMapMessage(event.nativeEvent.data);
              }}
            />
          )
        ) : (
          <View style={styles.mapPlaceholder}>
            <Icon name="map-outline" size={28} color={colors.textMuted ?? "#64748b"} />
            <Text style={styles.mapPlaceholderText}>
              No mapped sites yet - sites appear here once their projects have server geofences.
            </Text>
          </View>
        )}
      </View>

      {/* ── 2. Floating Top-Right Controls (No bulky top bar) ────────────────── */}
      <View style={styles.floatingControls} pointerEvents="box-none">
        <Pressable
          style={[styles.mapIconBtn, { backgroundColor: isPureDark ? "#121212" : "#FFFFFF" }]}
          onPress={toggleMapType}
          accessibilityRole="button"
          accessibilityLabel={
            mapType === "street" ? "Switch to satellite imagery" : "Switch to street map"
          }
        >
          <Icon
            name={mapType === "street" ? "layers-outline" : "map-outline"}
            size={19}
            color={isPureDark ? "#FFFFFF" : "#002449"}
          />
        </Pressable>

        <Pressable
          style={[styles.mapIconBtn, { backgroundColor: isPureDark ? "#121212" : "#FFFFFF" }]}
          onPress={() => void handleFocusMyLocation()}
          accessibilityRole="button"
          accessibilityLabel="Focus map on my current location"
        >
          <Icon name="locate" size={19} color={isPureDark ? "#FFFFFF" : "#002449"} />
          {locationStatus === "ready" && <View style={styles.gpsActiveDot} />}
        </Pressable>
      </View>

      {/* ── 3. Bottom Overlay: one frameless card ──────────────────────────── */}
      <View style={styles.bottomOverlay} pointerEvents="box-none">
        {!loading && cachedInspections.length === 0 && (
          <View
            style={[styles.emptyCard, { backgroundColor: theme.bgSurface }]}
            pointerEvents="auto"
          >
            <Icon name="clipboard-outline" size={22} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              No active inspection assignments
            </Text>
          </View>
        )}

        {!loading && cachedInspections.length > 0 && mapSites.length === 0 && (
          <View
            style={[styles.emptyCard, { backgroundColor: theme.bgSurface }]}
            pointerEvents="auto"
          >
            <Icon name="map-outline" size={22} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Assigned sites have no map coordinates yet - a geofence must be sealed for each
              project first.
            </Text>
          </View>
        )}

        {selectedSite && (
          <View
            style={[styles.siteCard, { backgroundColor: theme.bgSurface }]}
            pointerEvents="auto"
          >
            <View style={styles.cardHead}>
              <View style={styles.cardStatusGroup}>
                <Text
                  style={[
                    styles.cardStatus,
                    {
                      color:
                        selectedSite.status === "in_progress"
                          ? theme.actionGreen
                          : theme.accentBlue,
                    },
                  ]}
                >
                  {selectedSite.status.replace(/_/g, " ")}
                </Text>
                <Text style={[styles.cardDistance, { color: theme.textMuted }]}>
                  {fmtDistance(selectedSite.distanceMeters)} away
                </Text>
              </View>

              {mapSites.length > 1 && (
                <View style={styles.stepper}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.stepBtn,
                      { backgroundColor: theme.bgSubtle },
                      pressed && styles.stepBtnPressed,
                    ]}
                    onPress={() => stepSite(-1)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Previous site"
                  >
                    <Icon name="chevron-back" size={16} color={theme.navyDark} />
                  </Pressable>
                  <Text style={[styles.stepCount, { color: theme.textMuted }]}>
                    {mapSites.findIndex((s) => s.id === selectedId) + 1}/{mapSites.length}
                  </Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.stepBtn,
                      { backgroundColor: theme.bgSubtle },
                      pressed && styles.stepBtnPressed,
                    ]}
                    onPress={() => stepSite(1)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Next site"
                  >
                    <Icon name="chevron-forward" size={16} color={theme.navyDark} />
                  </Pressable>
                </View>
              )}
            </View>

            <Text style={[styles.cardTitle, { color: theme.navyDark }]} numberOfLines={2}>
              {selectedSite.projectName}
            </Text>

            <Text style={[styles.cardSubtitle, { color: theme.textMuted }]} numberOfLines={1}>
              {[
                selectedSite.projectCode,
                formatInspectionType(selectedSite.type),
                selectedSite.districtId,
              ]
                .filter(Boolean)
                .join(" \u00b7 ")}
            </Text>

            <View style={styles.actionRow}>
              <Pressable
                style={[styles.navBtn, { backgroundColor: theme.bgSubtle }]}
                onPress={handleNavigate}
                accessibilityRole="button"
                accessibilityLabel="Open directions to this site"
              >
                <Icon name="navigate-outline" size={16} color={theme.navyDark} />
                <Text style={[styles.navBtnText, { color: theme.navyDark }]}>Directions</Text>
              </Pressable>

              <Pressable
                style={[styles.actionBtn, { backgroundColor: theme.actionGreen }]}
                onPress={handleOpenInspection}
                accessibilityRole="button"
                accessibilityLabel="Open inspection"
              >
                <Text style={[styles.actionBtnText, { color: "#FFFFFF" }]}>Open Inspection</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F6F8FC",
  },

  // Map layer - fills full screen
  mapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  iframe: {
    flex: 1,
    width: "100%",
    height: "100%",
    borderWidth: 0,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  mapPlaceholderText: {
    fontSize: 14,
    color: colors.textMuted ?? "#64748b",
    fontWeight: "500",
  },

  // Floating top controls (No bulky top bar)
  floatingControls: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 16,
    right: 16,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mapIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOpacity: 0.18,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  gpsActiveDot: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#15803d",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },

  // Bottom overlay
  bottomOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingBottom: 0,
    gap: 8,
  },

  // Empty state card
  emptyCard: {
    marginHorizontal: 16,
    marginBottom: Platform.OS === "ios" ? 24 : 12,
    borderRadius: 12,
    paddingVertical: 22,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "500",
  },

  // Selected site card: frameless, lifted off the map
  siteCard: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 26 : 16,
    gap: 3,
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOpacity: 0.16,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: -3 },
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cardStatusGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnPressed: {
    opacity: 0.55,
  },
  stepCount: {
    fontSize: 11,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
    minWidth: 34,
    textAlign: "center",
  },
  cardStatus: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    includeFontPadding: false,
  },
  cardDistance: {
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
    includeFontPadding: false,
  },

  // Action Buttons Row
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  navBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderRadius: 8,
  },
  navBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  actionBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },

  // Statutory Permission Rationale View
  rationaleCard: {
    width: "100%",
    maxWidth: 500,
    borderWidth: 1,
    borderRadius: 8,
    padding: 24,
  },
  rationaleHeader: {
    marginBottom: 14,
  },
  rationaleBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#FFDAD6",
    borderColor: "#FFB4AB",
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 10,
  },
  rationaleBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#BA1A1A",
  },
  rationaleTitle: {
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 22,
  },
  rationaleBody: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  rationaleNoteBox: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    marginBottom: 18,
  },
  rationaleNoteText: {
    fontSize: 11,
    lineHeight: 18,
  },
  rationaleBtnCol: {
    width: "100%",
  },
});
