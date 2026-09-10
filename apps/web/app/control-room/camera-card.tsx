"use client";

import { useState } from "react";
import type { PublicCctvCamera, AuthorizedStream } from "@netram/types";

export interface CameraCardProps {
  camera: PublicCctvCamera;
}

export function CameraCard({ camera }: CameraCardProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamData, setStreamData] = useState<AuthorizedStream | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshotTimestamp, setSnapshotTimestamp] = useState(Date.now());

  const handleToggleStream = async () => {
    if (isStreaming) {
      setIsStreaming(false);
      setStreamData(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cctv/${camera.id}/streams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ttlSeconds: 300 }),
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(errJson.error?.message ?? `Failed to initiate stream (${res.status})`);
      }

      const data = (await res.json()) as AuthorizedStream;
      setStreamData(data);
      setIsStreaming(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to stream");
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshSnapshot = () => {
    setSnapshotTimestamp(Date.now());
  };

  return (
    <div className="camera-card">
      <div className="camera-header">
        <div>
          <h3 className="camera-title">{camera.name}</h3>
          <div className="camera-meta">
            <span>{camera.provider.toUpperCase()}</span>
            <span>•</span>
            <span>{camera.protocol.toUpperCase()}</span>
          </div>
        </div>
        <div className="status-indicator">
          <span className={`status-dot ${camera.status === "active" ? "online" : "offline"}`} />
          <span>{camera.status === "active" ? "ONLINE" : "OFFLINE"}</span>
        </div>
      </div>

      <div className="camera-viewport">
        <img
          src={`/api/cctv/${camera.id}/snapshot?t=${snapshotTimestamp}`}
          alt={camera.name}
          onError={(e) => {
            // Fallback placeholder style if snapshot load fails
            (e.target as HTMLElement).style.display = "none";
          }}
        />

        <div className="camera-overlay">
          <div className="camera-osd">{camera.name.toUpperCase()}</div>
          {isStreaming && (
            <div className="live-rec-badge">
              <span className="rec-dot" />
              <span>LIVE RELAY</span>
            </div>
          )}
        </div>
      </div>

      {isStreaming && streamData && (
        <div className="camera-stream-box">
          <div className="stream-relay-info">
            <span className="relay-status-pill">AUTHORIZED RELAY ACTIVE</span>
            <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
              Expires: {new Date(streamData.expiresAt).toLocaleTimeString()}
            </span>
          </div>
          <div className="stream-url-display">
            <strong>Relay Endpoint:</strong> {streamData.streamUrl}
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "0.5rem 1rem",
            background: "#450a0a",
            color: "#fca5a5",
            fontSize: "0.75rem",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      <div className="camera-controls">
        <button
          type="button"
          onClick={handleToggleStream}
          disabled={loading}
          className={`btn-stream ${isStreaming ? "btn-stream-stop" : ""}`}
        >
          {loading ? "Connecting..." : isStreaming ? "⏹ Disconnect Stream" : "▶ Start Live Stream"}
        </button>
        <button
          type="button"
          onClick={handleRefreshSnapshot}
          className="btn-snapshot"
          title="Refresh snapshot frame"
        >
          🔄 Snapshot
        </button>
      </div>
    </div>
  );
}
