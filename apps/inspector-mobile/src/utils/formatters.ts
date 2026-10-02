const INSPECTION_TYPE_LABELS: Record<string, string> = {
  routine: "Routine",
  surprise: "Surprise",
  special: "Special",
  social_audit: "Social audit",
  follow_up: "Follow up",
};

/**
 * Formats an inspection type identifier into a human-readable title-cased string.
 * e.g. "special" -> "Special", "social_audit" -> "Social audit", "surprise" -> "Surprise"
 */
export function formatInspectionType(type?: string | null): string {
  if (!type) return "Routine";
  const normalized = type.toLowerCase().trim();
  if (INSPECTION_TYPE_LABELS[normalized]) {
    return INSPECTION_TYPE_LABELS[normalized];
  }
  const clean = normalized.replace(/_/g, " ");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Formats an ISO datetime string (or Date) into a human-readable date-time string.
 * Falls back to "–" for invalid/empty values.
 */
export function formatDateTime(value?: string | null | Date): string {
  if (!value) return "–";
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "–";
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "–";
  }
}

/**
 * Formats a duration in seconds into a human-readable string (e.g. "1:02:34").
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:00";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
