"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getClient } from "../../lib/api";
import { AnomalyReviewPanel } from "./anomaly-review";
import type { AttendanceAnomaly, AttendanceReviewAction } from "@netram/types";

const REVIEW_ACTIONS_WITH_NOTE: string[] = [
  "acknowledge",
  "dismiss",
  "false_positive",
  "investigate",
  "actioned",
];

interface Props {
  anomalies: AttendanceAnomaly[];
}

export function AnomalyReviewClient({ anomalies }: Props) {
  const router = useRouter();
  const [reviewAnomaly, setReviewAnomaly] = useState<AttendanceAnomaly | null>(null);
  const [note, setNote] = useState("");

  const openReview = useCallback(() => {
    if (anomalies.length === 0) return;
    setReviewAnomaly(anomalies[0] ?? null);
    setNote("");
  }, [anomalies]);

  const handleReview = async (anomalyId: string, action: AttendanceReviewAction) => {
    try {
      const client = await getClient();
      const noteValue =
        REVIEW_ACTIONS_WITH_NOTE.includes(action) ? note : undefined;
      await client.reviewAttendanceAnomaly(anomalyId, { action, note: noteValue });
      router.refresh();
      const updated = await client.listAttendanceAnomalies({ pageSize: 20 });
      const items = updated.items;
      const nextAnomaly = items.find((a) => a.id === anomalyId);
      if (nextAnomaly !== undefined) {
        setReviewAnomaly(undefined as unknown as AttendanceAnomaly | null);
      setReviewAnomaly(nextAnomaly as AttendanceAnomaly);
      } else {
        setReviewAnomaly(null);
      }
    } catch (err) {
      console.error("Review failed:", err);
    }
  };

  const handleClose = () => {
    setReviewAnomaly(null);
    setNote("");
  };

  return (
    <>
      {/* Review button to open the modal */}
      {anomalies.length > 0 && (
        <button
          onClick={openReview}
          style={{
            background: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            padding: "0.4rem 0.75rem",
            fontSize: "0.8rem",
            fontWeight: 500,
            cursor: "pointer",
            marginTop: "0.5rem",
          }}
        >
          Review {anomalies.length} Anomaly{anomalies.length !== 1 ? "s" : ""}
        </button>
      )}

      {reviewAnomaly && (
        <AnomalyReviewPanel
          anomaly={reviewAnomaly}
          onReview={(action) => handleReview(reviewAnomaly.id, action)}
          onClose={handleClose}
        />
      )}
    </>
  );
}
