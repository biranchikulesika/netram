"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface RealtimeToast {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  timestamp: string;
}

export function RealtimeProvider() {
  const router = useRouter();
  const [toasts, setToasts] = useState<RealtimeToast[]>([]);
  const [_connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let unmounted = false;

    async function initWs() {
      try {
        const tokenRes = await fetch("/api/realtime/token");
        if (!tokenRes.ok) {
          // User not logged in; skip connecting
          return;
        }

        const { token, wsUrl } = (await tokenRes.json()) as { token: string; wsUrl: string };
        if (unmounted) return;

        const topics = [
          "inspection.started",
          "inspection.submitted",
          "inspection.status_transitioned",
          "project.status_transitioned",
          "vc_session.created",
          "vc_session.started",
          "vc_session.ended",
          "ai.anomaly_detected",
        ].join(",");

        const ws = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}&topics=${topics}`);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!unmounted) setConnected(true);
        };

        ws.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data as string) as {
              event: string;
              data?: {
                type: string;
                resourceType: string;
                resourceId: string;
                payload: Record<string, unknown>;
              };
            };

            if (data.event === "netram.event" && data.data) {
              const { type, payload } = data.data;

              let title = "Realtime Update";
              let message = `Event ${type} received`;
              let link: string | undefined;

              if (type === "vc_session.started") {
                title = "🎥 Live Hearing Started";
                message = String(payload.title ?? "A tripartite video review has begun");
                if (payload.inspectionId) {
                  link = `/dashboard/inspections/${payload.inspectionId}`;
                }
              } else if (type === "inspection.started" || type === "inspection.submitted") {
                title = "📋 Inspection Updated";
                message = `Inspection status transitioned (${type.split(".")[1]})`;
              } else if (type === "ai.anomaly_detected") {
                title = "⚠️ Advisory AI Signal";
                message = "New advisory anomaly flagged for review";
                link = "/dashboard/control-room";
              } else if (type.startsWith("project.")) {
                title = "🏗️ Project Updated";
                message = "Project state has been modified";
              }

              const newToast: RealtimeToast = {
                id: crypto.randomUUID(),
                type,
                title,
                message,
                link,
                timestamp: new Date().toLocaleTimeString(),
              };

              setToasts((prev) => [newToast, ...prev.slice(0, 4)]);

              // Automatically refresh server-rendered data
              router.refresh();

              // Auto-dismiss after 7 seconds
              setTimeout(() => {
                setToasts((current) => current.filter((t) => t.id !== newToast.id));
              }, 7000);
            }
          } catch {
            // ignore non-json messages
          }
        };

        ws.onclose = () => {
          if (!unmounted) {
            setConnected(false);
            reconnectTimeoutRef.current = setTimeout(initWs, 4000);
          }
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        if (!unmounted) {
          reconnectTimeoutRef.current = setTimeout(initWs, 5000);
        }
      }
    }

    void initWs();

    return () => {
      unmounted = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [router]);

  if (toasts.length === 0) return null;

  return (
    <div className="realtime-toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className="realtime-toast">
          <div className="toast-header">
            <strong>{toast.title}</strong>
            <span className="toast-time">{toast.timestamp}</span>
          </div>
          <p className="toast-body">{toast.message}</p>
          {toast.link && (
            <a href={toast.link} className="toast-action-link">
              View details →
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
