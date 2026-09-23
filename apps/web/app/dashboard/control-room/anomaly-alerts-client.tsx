"use client";

import type { AttendanceAnomaly } from "@netram/types";
import { AnomalyReviewClient } from "./attendance-review-client";

export function AnomalyAlertsClient({ anomalies }: { anomalies: AttendanceAnomaly[] }) {
  return <AnomalyReviewClient anomalies={anomalies} />;
}
