/**
 * app/check-in.tsx — Field Map & Check-In Screen
 *
 * Polished, high-clarity government oversight map interface:
 *   • Full-screen interactive map with inspector live GPS position
 *   • 1.0 km statutory geofence boundaries & route polyline
 *   • Minimal floating top-right controls: Street/Satellite toggle & GPS recenter
 *   • Compact single-row site picker pills with status indicators
 *   • Premium Govt White Theme action card (crisp white, institutional navy #002449)
 *   • Direct action buttons with zero duplicate distance or instructional clutter
 */
import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import { colors } from "../src/theme/colors";
import { useSettings } from "../src/theme/settings-context";
import {
  OfflineInspectionQueue,
  type CachedInspectionRecord,
} from "../src/offline/queue";
import { Icon } from "../src/components/ui/Icon";
import { useAuth } from "../src/auth/auth-context";
import type { Project, ProjectGeofence } from "@netram/types";
import {
  seedDemoDataIfEmpty,
  DEMO_GEOFENCES,
} from "../src/offline/demo-seed";
import { NetramButton } from "../src/components/ui/NetramButton";
import { WebView } from "react-native-webview";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3;
  const f1 = (lat1 * Math.PI) / 180;
  const f2 = (lat2 * Math.PI) / 180;
  const df = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(df / 2) ** 2 +
    Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function fmtDistance(m: number | null): string {
  if (m === null) return "–";
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${m} m`;
}

// Default district coordinates for Odisha (fallback)
const FALLBACK_COORDS = { lat: 20.2961, lng: 85.8245 };

interface MapSite {
  id: string;
  projectCode: string;
  projectName: string;
  status: string;
  type: string;
  districtId: string | null;
  lat: number;
  lng: number;
  radiusMeters: number;
  distanceMeters: number | null;
  withinGeofence: boolean;
}

const queue = new OfflineInspectionQueue();

// ---------------------------------------------------------------------------
// Leaflet HTML — injected into iframe / WebView
// ---------------------------------------------------------------------------

function buildLeafletHtml(params: {
  sites: MapSite[];
  selectedId: string;
  userLat: number | null;
  userLng: number | null;
  userAccuracy: number | null;
  centerLat: number;
  centerLng: number;
  zoom: number;
  mapType?: "street" | "satellite";
  isDark?: boolean;
}): string {
  const {
    sites,
    selectedId,
    userLat,
    userLng,
    userAccuracy,
    centerLat,
    centerLng,
    zoom,
    mapType = "street",
    isDark = false,
  } = params;

  const sitesJson = JSON.stringify(sites);

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

    /* Inspector live pulsing dot */
    .user-dot{width:18px;height:18px;background:#2563eb;border:3px solid #fff;border-radius:50%;
      box-shadow:0 0 0 0 rgba(37,99,235,.6);animation:pulse 2s infinite}
    @keyframes pulse{
      0%{box-shadow:0 0 0 0 rgba(37,99,235,.6)}
      70%{box-shadow:0 0 0 16px rgba(37,99,235,0)}
      100%{box-shadow:0 0 0 0 rgba(37,99,235,0)}
    }

    /* Site pin — official teardrop shape */
    .site-pin{
      width:34px;height:34px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;
      border:2.5px solid ${isDark ? "#27272a" : "#fff"};box-shadow:0 3px 10px rgba(0,36,73,${isDark ? "0.6" : "0.25"});
      cursor:pointer;transition:transform .15s ease
    }
    .site-pin.sel{transform:rotate(-45deg) scale(1.22);box-shadow:0 0 0 4px rgba(0,36,73,.28),0 4px 12px rgba(0,0,0,${isDark ? "0.7" : "0.35"})}
    .pin-inner{transform:rotate(45deg);font-size:11px;font-weight:800;color:#fff;line-height:1}
    .pin-default{background:${isDark ? "#1e3a8a" : "#002449"}}
    .pin-progress{background:#15803d}
    .pin-special{background:#c2410c}

    /* Stop badge (for sites outside geofence) */
    .stop-badge {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: ${isDark ? "#1e293b" : "#ffffff"};
      border: 2px solid ${isDark ? "#475569" : "#002449"};
      box-shadow: 0 2px 6px rgba(0,36,73,${isDark ? "0.5" : "0.15"});
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .stop-badge.sel-badge {
      background: #002449;
      border-color: #ffffff;
      transform: scale(1.15);
      box-shadow: 0 0 0 3px rgba(0,36,73,0.3), 0 3px 8px rgba(0,0,0,0.25);
    }
    .badge-inner {
      font-size: 11px;
      font-weight: 800;
      color: ${isDark ? "#e2e8f0" : "#002449"};
      line-height: 1;
    }
    .stop-badge.sel-badge .badge-inner {
      color: #ffffff;
    }

    /* Name badge below pin */
    .name-label{
      background:${isDark ? "rgba(18, 18, 18, 0.95)" : "rgba(255,255,255,0.98)"};
      border:1px solid ${isDark ? "#3f3f46" : "#cbd5e1"};border-radius:4px;
      padding:2px 6px;
      font-size:10px;font-weight:700;color:${isDark ? "#f8fafc" : "#002449"};
      white-space:nowrap;pointer-events:none;
      box-shadow:0 2px 5px rgba(0,36,73,${isDark ? "0.45" : "0.12"});
      text-align:center;
    }
    .name-label.sel-label{
      background:#002449;color:#fff;border-color:#002449;
    }

    /* Clean Zoom Controls */
    .leaflet-control-zoom {
      border:1px solid ${isDark ? "#27272a" : "#e2e8f0"}!important;
      border-radius:8px!important;
      overflow:hidden;
      box-shadow:0 2px 8px rgba(0,0,0,${isDark ? "0.4" : "0.08"})!important;
      top:16px!important;
      left:16px!important;
    }
    .leaflet-control-zoom a{
      background:${isDark ? "#18181b" : "#ffffff"}!important;
      color:${isDark ? "#f8fafc" : "#002449"}!important;
      border-color:${isDark ? "#27272a" : "#e2e8f0"}!important;
      font-size:15px!important;
      width:32px!important;
      height:32px!important;
      line-height:32px!important;
    }
    .leaflet-control-attribution{display:none}
  </style>
</head>
<body>
<div id="map"></div>

<script>
  const SITES = ${sitesJson};
  let SELECTED_ID = "${selectedId}";
  const USER_LAT = ${userLat ?? "null"};
  const USER_LNG = ${userLng ?? "null"};
  const USER_ACC = ${userAccuracy ?? "null"};
  const IS_DARK = ${isDark ? "true" : "false"};

  const map = L.map('map', {zoomControl: true, attributionControl: false})
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
    drawAllPaths();
    const msg = JSON.stringify({type:'SELECT_SITE', siteId: siteId});
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(msg);
    } else {
      window.parent.postMessage(msg, '*');
    }
  };

  window.recenterMap = function() {
    if (USER_LAT !== null && USER_LNG !== null) {
      map.setView([USER_LAT, USER_LNG], 15);
    } else if (SELECTED_ID) {
      const s = SITES.find(x => x.id === SELECTED_ID);
      if (s) map.setView([s.lat, s.lng], 15);
    }
  };

  // Cross-platform message listener
  function handleIncoming(data) {
    if (!data) return;
    if (data.type === 'SET_MAP_TYPE' && (data.mapType === 'street' || data.mapType === 'satellite')) {
      window.switchLayer(data.mapType);
    }
    if (data.type === 'RECENTER') {
      window.recenterMap();
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

  function haversineDistM(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) +
              Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180) *
              Math.sin(dLon/2)*Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function getPerimeterPoint(fromLat, fromLng, toLat, toLng, radiusMeters) {
    const dLat = fromLat - toLat;
    const dLon = (fromLng - toLng) * Math.cos(toLat * Math.PI / 180);
    const angle = Math.atan2(dLat, dLon);
    const latOffset = (radiusMeters / 111320) * Math.sin(angle);
    const lngOffset = (radiusMeters / (111320 * Math.cos(toLat * Math.PI / 180))) * Math.cos(angle);
    return [toLat + latOffset, toLng + lngOffset];
  }

  // Active route polyline
  let activeRouteLayer = null;

  function drawAllPaths() {
    if (activeRouteLayer) {
      map.removeLayer(activeRouteLayer);
      activeRouteLayer = null;
    }

    if (USER_LAT === null || USER_LNG === null || !SELECTED_ID) return;

    const site = SITES.find(s => s.id === SELECTED_ID);
    if (!site) return;

    const totalDist = haversineDistM(USER_LAT, USER_LNG, site.lat, site.lng);
    let destLat = site.lat;
    let destLng = site.lng;
    if (!site.withinGeofence && totalDist > 1000) {
      const perim = getPerimeterPoint(USER_LAT, USER_LNG, site.lat, site.lng, 1000);
      destLat = perim[0];
      destLng = perim[1];
    }

    // Road-following via OSRM with straight-line fallback
    const url = 'https://router.project-osrm.org/route/v1/driving/'
      + USER_LNG + ',' + USER_LAT + ';'
      + destLng + ',' + destLat
      + '?overview=full&geometries=geojson';

    fetch(url, {signal: AbortSignal.timeout(5000)})
      .then(res => res.json())
      .then(json => {
        if (activeRouteLayer) map.removeLayer(activeRouteLayer);
        if (json.code === 'Ok' && json.routes && json.routes[0]) {
          const rawCoords = json.routes[0].geometry.coordinates;
          let finalCoords = rawCoords;
          if (!site.withinGeofence) {
            finalCoords = [];
            for (let i = 0; i < rawCoords.length; i++) {
              const pt = rawCoords[i];
              const d = haversineDistM(pt[1], pt[0], site.lat, site.lng);
              if (d >= 1000 - 10) {
                finalCoords.push(pt);
              } else {
                break;
              }
            }
            if (finalCoords.length < 2) {
              finalCoords = rawCoords.slice(0, Math.min(2, rawCoords.length));
            }
          }
          activeRouteLayer = L.geoJSON({ type: "LineString", coordinates: finalCoords }, {
            style: { color: '#002449', weight: 4.5, opacity: 0.95 }
          }).addTo(map);
        } else {
          activeRouteLayer = L.polyline([[USER_LAT, USER_LNG], [destLat, destLng]], {
            color: '#002449', weight: 4, dashArray: '10,6', opacity: 0.9
          }).addTo(map);
        }
      })
      .catch(() => {
        if (activeRouteLayer) map.removeLayer(activeRouteLayer);
        activeRouteLayer = L.polyline([[USER_LAT, USER_LNG], [destLat, destLng]], {
          color: '#002449', weight: 4, dashArray: '10,6', opacity: 0.9
        }).addTo(map);
      });
  }

  // Draw selected route initially
  drawAllPaths();

  // Site markers & 1.0 km geofence circles
  SITES.forEach((site, idx) => {
    const isSel = site.id === SELECTED_ID;

    const pinClass = (site.status === 'in_progress' || site.status === 'evidence_collection')
      ? 'pin-progress'
      : site.type === 'special' ? 'pin-special' : 'pin-default';

    const distStr = site.distanceMeters !== null
      ? (site.distanceMeters >= 1000
          ? (site.distanceMeters/1000).toFixed(1)+' km'
          : site.distanceMeters+' m')
      : null;

    // 1.0 km statutory geofence boundary circle
    const circle = L.circle([site.lat, site.lng], {
      radius: 1000,
      color: isSel ? '#002449' : (IS_DARK ? '#475569' : '#94a3b8'),
      weight: isSel ? 2.5 : 1.5,
      fillColor: isSel ? '#002449' : (IS_DARK ? '#334155' : '#cbd5e1'),
      fillOpacity: isSel ? 0.12 : 0.05,
      dashArray: '6,5'
    }).addTo(map);

    circle.on('click', () => {
      window.switchSite(site.id);
    });

    circle.bindTooltip(
      '<b>' + (site.withinGeofence ? site.projectCode : 'Site ' + (idx+1)) + '</b>' +
      (distStr ? ' • ' + distStr : ''),
      { sticky: true }
    );

    if (site.withinGeofence) {
      const pinHtml =
        '<div class="site-pin' + (isSel ? ' sel' : '') + '">' +
          '<div class="pin-inner ' + pinClass + '">' + (idx+1) + '</div>' +
        '</div>';

      const pinIcon = L.divIcon({
        className: '',
        html: pinHtml,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        popupAnchor: [0, -36]
      });
      const marker = L.marker([site.lat, site.lng], {icon: pinIcon}).addTo(map);

      const labelHtml = '<div class="name-label' + (isSel ? ' sel-label' : '') + '">' +
        site.projectCode +
        '</div>';
      L.marker([site.lat, site.lng], {
        icon: L.divIcon({
          className: '',
          html: labelHtml,
          iconSize: [0,0],
          iconAnchor: [-16, -8]
        }),
        interactive: false,
        zIndexOffset: -1
      }).addTo(map);

      marker.on('click', () => {
        window.switchSite(site.id);
      });
    } else {
      // Outside 1km geofence: clean clickable stop badge
      const stopBadgeHtml =
        '<div class="stop-badge' + (isSel ? ' sel-badge' : '') + '">' +
          '<div class="badge-inner">' + (idx+1) + '</div>' +
        '</div>';
      const stopMarker = L.marker([site.lat, site.lng], {
        icon: L.divIcon({
          className: '',
          html: stopBadgeHtml,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -16]
        })
      }).addTo(map);

      stopMarker.on('click', () => {
        window.switchSite(site.id);
      });

      stopMarker.bindTooltip(
        '<b>Site ' + (idx+1) + '</b>' + (distStr ? ' • ' + distStr : ''),
        { direction: 'top', offset: [0, -14] }
      );
    }
  });

  // Inspector GPS live pulsing dot
  if (USER_LAT !== null && USER_LNG !== null) {
    if (USER_ACC && USER_ACC < 2000) {
      L.circle([USER_LAT, USER_LNG], {
        radius: USER_ACC,
        color:'#2563eb', weight:1,
        fillColor:'#2563eb', fillOpacity:0.07
      }).addTo(map);
    }

    const userIcon = L.divIcon({
      className: '',
      html: '<div class="user-dot"></div>',
      iconSize:[18,18],
      iconAnchor:[9,9]
    });
    L.marker([USER_LAT, USER_LNG], {icon: userIcon, zIndexOffset: 1000})
      .addTo(map);
  }

  // Initial map positioning
  if (SELECTED_ID) {
    const selSite = SITES.find(s => s.id === SELECTED_ID);
    if (selSite) {
      const pts = [[selSite.lat, selSite.lng]];
      if (USER_LAT !== null) pts.push([USER_LAT, USER_LNG]);
      map.fitBounds(L.latLngBounds(pts), {padding:[60,60], maxZoom:14});
    }
  } else if (SITES.length > 0) {
    const lls = SITES.map(s => [s.lat, s.lng]);
    if (USER_LAT !== null) lls.push([USER_LAT, USER_LNG]);
    map.fitBounds(L.latLngBounds(lls), {padding:[50,50], maxZoom:13});
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
  const [remoteProjects, setRemoteProjects] = useState<Project[]>([]);
  const [remoteGeofences, setRemoteGeofences] = useState<ProjectGeofence[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    params.inspectionId ?? null,
  );
  const [checkingIn, setCheckingIn] = useState(false);
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
  const [locationStatus, setLocationStatus] = useState<
    "loading" | "denied" | "ready" | "error"
  >("loading");
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadData = useCallback(async () => {
    try {
      await seedDemoDataIfEmpty();

      const local = await queue.getCachedInspections();
      setCachedInspections(local);

      if (client) {
        const [inspRes, projRes, geoRes] = await Promise.allSettled([
          client.listInspections({ pageSize: 50 }),
          client.listProjects({ pageSize: 50 }),
          client.listProjectGeofences(),
        ]);
        if (inspRes.status === "fulfilled" && inspRes.value.items.length > 0) {
          await queue.cacheInspections(inspRes.value.items);
          setCachedInspections(await queue.getCachedInspections());
        }
        if (projRes.status === "fulfilled") setRemoteProjects(projRes.value.items);
        if (geoRes.status === "fulfilled") setRemoteGeofences(geoRes.value);
      }
    } catch {
      // offline — use cached data
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

  const acquireLocation = useCallback(async () => {
    try {
      setLocationStatus("loading");
      const perm = await Location.getForegroundPermissionsAsync();
      const granted = perm.granted
        ? true
        : (await Location.requestForegroundPermissionsAsync()).granted;

      if (!granted) {
        setLocationStatus("denied");
        return;
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
    } catch {
      setLocationStatus("error");
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

  const mapSites = useMemo<MapSite[]>(() => {
    const projMap = new Map<string, Project>();
    remoteProjects.forEach((p) => projMap.set(p.id, p));

    const geoMap = new Map<string, { centerLat: number; centerLng: number; radiusMeters: number }>();
    DEMO_GEOFENCES.forEach((g) =>
      geoMap.set(g.projectId, {
        centerLat: g.centerLat,
        centerLng: g.centerLng,
        radiusMeters: g.radiusMeters,
      }),
    );
    remoteGeofences.forEach((g) => {
      if (g.centerLat !== null && g.centerLng !== null) {
        geoMap.set(g.projectId, {
          centerLat: g.centerLat,
          centerLng: g.centerLng,
          radiusMeters: g.radiusMeters,
        });
      }
    });

    return cachedInspections.map((insp, i) => {
      const geo = geoMap.get(insp.project_id);

      let lat = FALLBACK_COORDS.lat + ((i % 5) - 2) * 0.006;
      let lng = FALLBACK_COORDS.lng + (((i * 3) % 5) - 2) * 0.006;

      if (geo) {
        lat = geo.centerLat;
        lng = geo.centerLng;
      }

      const radius = geo?.radiusMeters ?? 1000;

      let distanceMeters: number | null = null;
      let withinGeofence = false;

      const isFresh = location && Date.now() - (location.acquiredAt ?? 0) < 5 * 60 * 1000;

      if (location && isFresh) {
        distanceMeters = haversineMeters(
          location.latitude,
          location.longitude,
          lat,
          lng,
        );
        withinGeofence = distanceMeters <= radius;
      }

      return {
        id: insp.id,
        projectCode: insp.project_code || `PRJ-${i + 1}`,
        projectName: insp.project_name || "Inspection Site",
        status: insp.status || "assigned",
        type: insp.type || "routine",
        districtId: insp.district_id,
        lat,
        lng,
        radiusMeters: radius,
        distanceMeters,
        withinGeofence,
      };
    });
  }, [cachedInspections, remoteProjects, remoteGeofences, location]);

  // Auto-select first active site
  useEffect(() => {
    if (!selectedId && mapSites.length > 0) {
      const active =
        mapSites.find(
          (s) =>
            s.status === "in_progress" ||
            s.status === "assigned" ||
            s.status === "scheduled",
        ) ?? mapSites[0];
      if (active) setSelectedId(active.id);
    }
  }, [selectedId, mapSites]);

  // Silent automatic arrival check-in
  const autoCheckedInRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!location || mapSites.length === 0) return;

    const reachedSites = mapSites.filter(
      (s) =>
        s.withinGeofence &&
        (s.status === "assigned" || s.status === "in_progress" || s.status === "scheduled"),
    );

    if (reachedSites.length > 0) {
      reachedSites.sort(
        (a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity),
      );
      const closest = reachedSites[0];
      if (!closest) return;

      if (selectedId !== closest.id) {
        setSelectedId(closest.id);
      }

      if (!autoCheckedInRef.current.has(closest.id)) {
        autoCheckedInRef.current.add(closest.id);
        void (async () => {
          try {
            const allOps = await queue.getAllOperations();
            const alreadyCheckedIn = allOps.some(
              (o) =>
                o.inspection_id === closest.id &&
                (o.operation_type === "check_in" || o.operation_type === "start_inspection"),
            );
            if (!alreadyCheckedIn) {
              await queue.checkIn(
                closest.id,
                location.latitude,
                location.longitude,
                location.accuracy,
              );
            }
          } catch (err) {
            console.debug("Silent arrival check-in error:", err);
          }
        })();
      }
    }
  }, [location, mapSites, selectedId]);

  const selectedSite = useMemo(
    () => mapSites.find((s) => s.id === selectedId) ?? null,
    [mapSites, selectedId],
  );

  const selectedIndex = useMemo(() => {
    if (!selectedSite) return -1;
    return mapSites.findIndex((s) => s.id === selectedSite.id);
  }, [mapSites, selectedSite]);

  // ---------------------------------------------------------------------------
  // Map HTML & center coordinates
  // ---------------------------------------------------------------------------

  const mapCenter = useMemo(() => {
    if (selectedSite) return { lat: selectedSite.lat, lng: selectedSite.lng };
    if (location) return { lat: location.latitude, lng: location.longitude };
    return FALLBACK_COORDS;
  }, [selectedSite, location]);

  const leafletHtml = useMemo(
    () =>
      buildLeafletHtml({
        sites: mapSites,
        selectedId: selectedSite?.id ?? "",
        userLat: location?.latitude ?? null,
        userLng: location?.longitude ?? null,
        userAccuracy: location?.accuracy ?? null,
        centerLat: mapCenter.lat,
        centerLng: mapCenter.lng,
        zoom: 13,
        mapType,
        isDark: isPureDark,
      }),
    [mapSites, selectedSite, location, mapCenter, mapType, isPureDark],
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
      if (
        d?.type === "MAP_TYPE_CHANGED" &&
        (d.mapType === "street" || d.mapType === "satellite")
      ) {
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

  const toggleMapType = () => {
    const nextType = mapType === "street" ? "satellite" : "street";
    setMapType(nextType);
    const msg = JSON.stringify({ type: "SET_MAP_TYPE", mapType: nextType });
    if (Platform.OS === "web" && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(msg, "*");
    } else if (webViewRef.current) {
      webViewRef.current.postMessage(msg);
    }
  };

  const handleRecenter = () => {
    void acquireLocation();
    const msg = JSON.stringify({ type: "RECENTER" });
    if (Platform.OS === "web" && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(msg, "*");
    } else if (webViewRef.current) {
      webViewRef.current.postMessage(msg);
    }
  };

  const handleNavigate = () => {
    if (!selectedSite) return;
    const url =
      Platform.OS === "ios"
        ? `maps:0,0?q=${selectedSite.lat},${selectedSite.lng}`
        : `geo:${selectedSite.lat},${selectedSite.lng}?q=${selectedSite.lat},${selectedSite.lng}`;
    void Linking.openURL(url);
  };

  const handleOpenInspection = async () => {
    if (!selectedSite) return;
    if (location && selectedSite.withinGeofence) {
      try {
        setCheckingIn(true);
        const allOps = await queue.getAllOperations();
        const alreadyCheckedIn = allOps.some(
          (o) =>
            o.inspection_id === selectedSite.id &&
            (o.operation_type === "check_in" || o.operation_type === "start_inspection"),
        );
        if (!alreadyCheckedIn) {
          await queue.checkIn(
            selectedSite.id,
            location.latitude,
            location.longitude,
            location.accuracy,
          );
        }
      } catch {
        // silent check-in
      } finally {
        setCheckingIn(false);
      }
    }
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
            <View style={styles.rationaleBadge}>
              <Text style={styles.rationaleBadgeText}>STATUTORY MANDATE</Text>
            </View>
            <Text
              style={[
                styles.rationaleTitle,
                { color: isPureDark ? "#FFFFFF" : "#002449" },
              ]}
            >
              Location Verification Required
            </Text>
          </View>

          <Text
            style={[
              styles.rationaleBody,
              { color: isPureDark ? "#A1A1AA" : "#475569" },
            ]}
          >
            Real-time GPS verification is required under Netram Oversight Regulations
            to confirm presence within designated 1.0 km project geofences before unlocking
            inspection records.
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
            <Text
              style={[
                styles.rationaleNoteText,
                { color: isPureDark ? "#CBD5E1" : "#334155" },
              ]}
            >
              • Confirms physical presence within 1.0 km geofence perimeter.{"\n"}
              • Stamps cryptographic coordinates on captured field evidence.{"\n"}
              • Safeguards integrity of official public oversight audits.
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
        ) : Platform.OS === "web" ? (
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
        )}
      </View>

      {/* ── 2. Floating Top-Right Controls (No bulky top bar) ────────────────── */}
      <View style={styles.floatingControls} pointerEvents="box-none">
        {/* Map Type Toggle Pill */}
        <Pressable
          style={[
            styles.floatingTogglePill,
            {
              backgroundColor: isPureDark ? "#121212" : "#FFFFFF",
              borderColor: isPureDark ? "#27272A" : "#E2E8F0",
            },
          ]}
          onPress={toggleMapType}
          accessibilityLabel="Switch map style"
        >
          <View
            style={[
              styles.toggleSegment,
              mapType === "street" && [
                styles.toggleSegmentActive,
                { backgroundColor: isPureDark ? "#3B82F6" : "#002449" },
              ],
            ]}
          >
            <Text
              style={[
                styles.toggleSegmentText,
                mapType === "street"
                  ? styles.toggleSegmentTextActive
                  : { color: isPureDark ? "#A1A1AA" : "#475569" },
              ]}
            >
              Street
            </Text>
          </View>
          <View
            style={[
              styles.toggleSegment,
              mapType === "satellite" && [
                styles.toggleSegmentActive,
                { backgroundColor: isPureDark ? "#3B82F6" : "#002449" },
              ],
            ]}
          >
            <Text
              style={[
                styles.toggleSegmentText,
                mapType === "satellite"
                  ? styles.toggleSegmentTextActive
                  : { color: isPureDark ? "#A1A1AA" : "#475569" },
              ]}
            >
              Sat
            </Text>
          </View>
        </Pressable>

        {/* GPS Recenter Button */}
        <Pressable
          style={[
            styles.floatingCircleBtn,
            {
              backgroundColor: isPureDark ? "#121212" : "#FFFFFF",
              borderColor: isPureDark ? "#27272A" : "#E2E8F0",
            },
          ]}
          onPress={handleRecenter}
          accessibilityLabel="Center map on your location"
        >
          <Icon
            name="navigate"
            size={17}
            color={isPureDark ? "#FFFFFF" : "#002449"}
          />
          {locationStatus === "ready" && <View style={styles.gpsActiveDot} />}
        </Pressable>
      </View>

      {/* ── 3. Bottom Overlay: Compact Chips + Govt White Theme Card ─────────── */}
      <View style={styles.bottomOverlay} pointerEvents="box-none">
        {/* Horizontal Site Picker Chips */}
        {mapSites.length > 0 && (
          <View pointerEvents="auto">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipStrip}
            >
              {mapSites.map((site, idx) => {
                const isSelected = site.id === selectedId;
                return (
                  <Pressable
                    key={site.id}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected
                          ? theme.navyDark
                          : theme.bgSurface,
                        borderColor: isSelected
                          ? theme.navyDark
                          : theme.borderSubtle,
                      },
                    ]}
                    onPress={() => setSelectedId(site.id)}
                  >
                    <View
                      style={[
                        styles.chipDot,
                        {
                          backgroundColor: site.withinGeofence
                            ? theme.actionGreen
                            : site.status === "in_progress"
                              ? theme.gold
                              : site.type === "special"
                                ? theme.tagRust
                                : theme.accentBlue,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: isSelected
                            ? "#FFFFFF"
                            : theme.textPrimary,
                          fontWeight: isSelected ? "700" : "600",
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {site.withinGeofence
                        ? `${site.projectCode} • ${fmtDistance(site.distanceMeters)}`
                        : `Site ${idx + 1} • ${fmtDistance(site.distanceMeters)}`}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Empty State */}
        {!loading && mapSites.length === 0 && (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: isPureDark ? "#121212" : "#FFFFFF",
                borderColor: isPureDark ? "#27272A" : "#E2E8F0",
              },
            ]}
            pointerEvents="auto"
          >
            <Icon name="clipboard-outline" size={22} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              No active inspection assignments
            </Text>
          </View>
        )}

        {/* Selected Site Action Card (Govt White Theme) */}
        {selectedSite && (
          <View
            style={[
              styles.siteCard,
              {
                backgroundColor: theme.bgSurface,
                borderColor: theme.borderSubtle,
              },
            ]}
            pointerEvents="auto"
          >
            {/* Header: Badges + Titles on Left, Distance on Right */}
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.badgeRow}>
                  {/* Status Badge */}
                  <View
                    style={[
                      styles.badge,
                      selectedSite.status === "in_progress"
                        ? styles.badgeGreen
                        : styles.badgeBlue,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        selectedSite.status === "in_progress"
                          ? styles.badgeTextGreen
                          : styles.badgeTextBlue,
                      ]}
                    >
                      {selectedSite.status.replace(/_/g, " ").toUpperCase()}
                    </Text>
                  </View>

                  {/* Geofence Status Pill */}
                  <View
                    style={[
                      styles.badge,
                      selectedSite.withinGeofence
                        ? styles.badgeGreen
                        : styles.badgeMuted,
                    ]}
                  >
                    <Icon
                      name={
                        selectedSite.withinGeofence
                          ? "checkmark-circle"
                          : "lock-closed-outline"
                      }
                      size={11}
                      color={selectedSite.withinGeofence ? theme.actionGreen : theme.textSubtle}
                    />
                    <Text
                      style={[
                        styles.badgeText,
                        selectedSite.withinGeofence
                          ? styles.badgeTextGreen
                          : styles.badgeTextMuted,
                      ]}
                    >
                      {selectedSite.withinGeofence ? "ON-SITE" : "1.0 KM GEOFENCE"}
                    </Text>
                  </View>
                </View>

                {/* Primary Title */}
                <Text
                  style={[
                    styles.cardTitle,
                    { color: theme.navyDark },
                  ]}
                  numberOfLines={1}
                >
                  {selectedSite.withinGeofence
                    ? selectedSite.projectName
                    : `Assigned Site ${selectedIndex + 1}`}
                </Text>

                {/* Subtitle / Metadata */}
                <Text
                  style={[
                    styles.cardSubtitle,
                    { color: theme.textMuted },
                  ]}
                  numberOfLines={1}
                >
                  {selectedSite.withinGeofence
                    ? `${selectedSite.projectCode} • ${selectedSite.type.replace(/_/g, " ").toUpperCase()}${selectedSite.districtId ? ` • ${selectedSite.districtId}` : ""}`
                    : `${selectedSite.projectCode} • Physical presence required to unlock`}
                </Text>
              </View>

              {/* Distance on Right */}
              <View style={styles.cardHeaderRight}>
                <Text
                  style={[
                    styles.cardDistanceValue,
                    { color: theme.navyDark },
                  ]}
                >
                  {fmtDistance(selectedSite.distanceMeters)}
                </Text>
                <Text
                  style={[
                    styles.cardDistanceLabel,
                    { color: theme.textMuted },
                  ]}
                >
                  distance
                </Text>
              </View>
            </View>

            {/* Action Row */}
            <View style={styles.actionRow}>
              <Pressable
                style={[
                  styles.navBtn,
                  {
                    backgroundColor: theme.bgSurface,
                    borderColor: theme.navyDark,
                  },
                ]}
                onPress={handleNavigate}
              >
                <Icon
                  name="navigate-outline"
                  size={16}
                  color={theme.navyDark}
                />
                <Text
                  style={[
                    styles.navBtnText,
                    { color: theme.navyDark },
                  ]}
                >
                  Directions
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.actionBtn,
                  selectedSite.withinGeofence
                    ? {
                        backgroundColor: theme.actionGreen,
                        borderColor: theme.actionGreen,
                      }
                    : styles.actionBtnDisabled,
                ]}
                onPress={handleOpenInspection}
                disabled={!selectedSite.withinGeofence && !location}
              >
                {checkingIn ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Icon
                      name={
                        selectedSite.withinGeofence
                          ? "clipboard-outline"
                          : "lock-closed-outline"
                      }
                      size={16}
                      color={selectedSite.withinGeofence ? "#FFFFFF" : theme.textSubtle}
                    />
                    <Text
                      style={[
                        styles.actionBtnText,
                        {
                          color: selectedSite.withinGeofence
                            ? "#FFFFFF"
                            : theme.textSubtle,
                        },
                      ]}
                    >
                      {selectedSite.withinGeofence
                        ? "Open Inspection"
                        : "Locked (Reach Site)"}
                    </Text>
                  </>
                )}
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

  // Map layer — fills full screen
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
  floatingTogglePill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    padding: 3,
  },
  toggleSegment: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  toggleSegmentActive: {},
  toggleSegmentText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  toggleSegmentTextActive: {
    color: "#FFFFFF",
  },
  floatingCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  gpsActiveDot: {
    position: "absolute",
    top: 6,
    right: 6,
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

  // Chip strip (single row)
  chipStrip: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipText: {
    fontSize: 11,
    letterSpacing: 0.2,
  },

  // Empty state card
  emptyCard: {
    marginHorizontal: 16,
    marginBottom: Platform.OS === "ios" ? 24 : 12,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "500",
  },

  // Selected site card — Govt White Theme
  siteCard: {
    marginHorizontal: 0,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 24 : 14,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  cardHeaderLeft: {
    flex: 1,
    gap: 2,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 0,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeBlue: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  badgeTextBlue: {
    fontSize: 9,
    fontWeight: "800",
    color: "#1D4ED8",
    letterSpacing: 0.4,
  },
  badgeGreen: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },
  badgeTextGreen: {
    fontSize: 9,
    fontWeight: "800",
    color: "#15803d",
    letterSpacing: 0.4,
  },
  badgeMuted: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
  },
  badgeTextMuted: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 0.4,
  },
  badgeText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  cardHeaderRight: {
    alignItems: "flex-end",
    minWidth: 54,
    paddingTop: 2,
  },
  cardDistanceValue: {
    fontSize: 17,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  cardDistanceLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
  },

  // Action Buttons Row
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  navBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 42,
    borderRadius: 8,
    borderWidth: 1.5,
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
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnDisabled: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
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
