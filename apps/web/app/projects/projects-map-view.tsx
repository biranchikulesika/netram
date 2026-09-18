"use client";

import dynamic from "next/dynamic";
import type { Project } from "@netram/types";

// Dynamically import the real Leaflet GIS Map with SSR disabled
const RealLeafletMap = dynamic(() => import("./real-leaflet-map"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: "calc(100vh - 205px)",
        minHeight: "440px",
        background: "var(--bg-subtle)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: "8px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        color: "var(--text-muted)",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "3px solid var(--color-border-strong)",
          borderTopColor: "var(--action-green)",
          animation: "spin 1s linear infinite",
        }}
      />
      <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
        Loading map…
      </div>
    </div>
  ),
});

interface ProjectsMapViewProps {
  projects: Project[];
  userRole?: string;
  isAuthority?: boolean;
}

export function ProjectsMapView({
  projects,
  userRole = "authority_officer",
  isAuthority = true,
}: ProjectsMapViewProps) {
  return (
    <RealLeafletMap
      projects={projects}
      userRole={userRole}
      isAuthority={isAuthority}
    />
  );
}
