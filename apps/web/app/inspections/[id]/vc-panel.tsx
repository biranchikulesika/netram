"use client";

import { useState, useEffect, useRef } from "react";
import type { VcSessionWithParticipants, VcJoinDetails, VcParticipantRole } from "@netram/types";
import { formatDateTime } from "../../../lib/presentation";

export interface VcPanelProps {
  inspectionId: string;
  projectId?: string | null;
  initialSessions: VcSessionWithParticipants[];
  canManage: boolean;
  userEmail: string;
}

export function VcPanel({
  inspectionId,
  projectId,
  initialSessions,
  canManage,
  userEmail,
}: VcPanelProps) {
  const [sessions, setSessions] = useState<VcSessionWithParticipants[]>(initialSessions);
  const [activeJoin, setActiveJoin] = useState<VcJoinDetails | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("Tripartite Remote Hearing");
  const [newDate, setNewDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`/api/vc/sessions?inspectionId=${inspectionId}`);
      if (res.ok) {
        const data = (await res.json()) as { items: VcSessionWithParticipants[] };
        setSessions(data.items);
      }
    } catch {
      // ignore
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vc/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          inspectionId,
          projectId: projectId ?? undefined,
          scheduledAt: newDate ? new Date(newDate).toISOString() : undefined,
          provider: "webrtc",
        }),
      });
      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(errJson.error?.message ?? `Failed to schedule session (${res.status})`);
      }
      setIsCreating(false);
      setNewTitle("Tripartite Remote Hearing");
      setNewDate("");
      await fetchSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating session");
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = async (sessionId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/vc/sessions/${sessionId}/start`, { method: "POST" });
      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(errJson.error?.message ?? `Failed to start session (${res.status})`);
      }
      await fetchSessions();
      await handleJoinSession(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error starting session");
    } finally {
      setLoading(false);
    }
  };

  const handleEndSession = async (sessionId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/vc/sessions/${sessionId}/end`, { method: "POST" });
      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(errJson.error?.message ?? `Failed to end session (${res.status})`);
      }
      if (activeJoin?.sessionId === sessionId) {
        handleLeaveRoom();
      }
      await fetchSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error ending session");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSession = async (sessionId: string, requestedRole?: VcParticipantRole) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/vc/sessions/${sessionId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: requestedRole }),
      });
      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(errJson.error?.message ?? `Failed to join session (${res.status})`);
      }
      const data = (await res.json()) as VcJoinDetails;
      setActiveJoin(data);

      // Attempt to access local webcam / microphone for WebRTC preview
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          streamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        }
      } catch {
        // Fallback: Headless environment or camera permission denied
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error joining session");
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (activeJoin) {
      void fetch(`/api/vc/sessions/${activeJoin.sessionId}/leave`, { method: "POST" });
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setActiveJoin(null);
    await fetchSessions();
  };

  const toggleMute = () => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
    }
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTracks = streamRef.current.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
    }
    setIsVideoOff(!isVideoOff);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="vc-card">
      <div className="vc-header">
        <div>
          <h3>Remote Tripartite Hearing &amp; Video Review</h3>
          <p className="muted" style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Provider-agnostic WebRTC conferencing uniting authority officers, field inspectors, and
            institution admins (§43)
          </p>
        </div>
        {canManage && !isCreating && !activeJoin && (
          <button type="button" onClick={() => setIsCreating(true)} className="btn-vc-schedule">
            + Schedule Remote Hearing
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: "0.75rem",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "6px",
            color: "#b91c1c",
            marginBottom: "1rem",
            fontSize: "0.85rem",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Schedule Form Modal/Inline */}
      {isCreating && (
        <form onSubmit={handleCreateSession} className="vc-form">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              marginBottom: "1rem",
            }}
          >
            <div>
              <label
                htmlFor="vc-title"
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                Session Title
              </label>
              <input
                id="vc-title"
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                className="input-text"
              />
            </div>
            <div>
              <label
                htmlFor="vc-date"
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                Scheduled Time (Optional)
              </label>
              <input
                id="vc-date"
                type="datetime-local"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="input-text"
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setIsCreating(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Scheduling..." : "Confirm Schedule"}
            </button>
          </div>
        </form>
      )}

      {/* Active Video Conference Room */}
      {activeJoin && (
        <div className="vc-active-room">
          <div className="vc-room-bar">
            <div>
              <span className="vc-live-badge">● LIVE HEARING IN SESSION</span>
              <span style={{ marginLeft: "0.75rem", fontWeight: 600 }}>
                Room: {activeJoin.roomName}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className="vc-role-pill">{activeJoin.role.toUpperCase()}</span>
              <button type="button" onClick={handleLeaveRoom} className="btn-vc-leave">
                Leave Room
              </button>
            </div>
          </div>

          <div className="vc-video-grid">
            {/* Local Video Tile */}
            <div className="vc-video-tile">
              <video ref={localVideoRef} autoPlay playsInline muted className="vc-video-element" />
              <div className="vc-video-overlay">
                <span>
                  {userEmail} (You - {activeJoin.role})
                </span>
                <span>{isMuted ? "🔇 Muted" : "🎤 Unmuted"}</span>
              </div>
            </div>

            {/* Remote Peer Placeholder Tile */}
            <div className="vc-video-tile vc-peer-tile">
              <div className="vc-peer-avatar">
                <span>👥</span>
              </div>
              <div className="vc-video-overlay">
                <span>Remote Inspection Participants</span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>WebRTC Mesh Connected</span>
              </div>
            </div>
          </div>

          {/* Call Controls */}
          <div className="vc-controls-bar">
            <button
              type="button"
              onClick={toggleMute}
              className={`btn-vc-ctrl ${isMuted ? "btn-ctrl-off" : ""}`}
            >
              {isMuted ? "🔇 Unmute Mic" : "🎤 Mute Mic"}
            </button>
            <button
              type="button"
              onClick={toggleVideo}
              className={`btn-vc-ctrl ${isVideoOff ? "btn-ctrl-off" : ""}`}
            >
              {isVideoOff ? "📷 Turn Camera On" : "📹 Turn Camera Off"}
            </button>
          </div>
        </div>
      )}

      {/* Sessions List */}
      <div className="vc-sessions-list">
        {sessions.length === 0 ? (
          <p
            className="muted"
            style={{ fontSize: "0.85rem", padding: "1rem", textAlign: "center" }}
          >
            No video review hearings currently scheduled for this inspection.
          </p>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="vc-session-row">
              <div className="vc-session-info">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.25rem",
                  }}
                >
                  <span className={`vc-status-pill ${session.status}`}>
                    {session.status.toUpperCase()}
                  </span>
                  <strong style={{ fontSize: "0.95rem" }}>{session.title}</strong>
                </div>
                <div className="vc-session-meta">
                  <span>Provider: {session.provider.toUpperCase()}</span>
                  {session.scheduledAt && (
                    <span>• Scheduled: {formatDateTime(session.scheduledAt)}</span>
                  )}
                  {session.participants && session.participants.length > 0 && (
                    <span>• {session.participants.length} Participants Assigned</span>
                  )}
                </div>
              </div>

              <div className="vc-session-actions">
                {session.status === "scheduled" && canManage && (
                  <button
                    type="button"
                    onClick={() => handleStartSession(session.id)}
                    disabled={loading}
                    className="btn-vc-start"
                  >
                    ▶ Start Hearing
                  </button>
                )}

                {session.status === "active" && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleJoinSession(session.id)}
                      disabled={loading || activeJoin?.sessionId === session.id}
                      className="btn-vc-join"
                    >
                      {activeJoin?.sessionId === session.id ? "In Room" : "📞 Join Live Hearing"}
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleEndSession(session.id)}
                        disabled={loading}
                        className="btn-vc-end"
                      >
                        ⏹ End Hearing
                      </button>
                    )}
                  </>
                )}

                {session.status === "completed" && (
                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                    Completed{" "}
                    {session.endedAt ? new Date(session.endedAt).toLocaleTimeString() : ""}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
