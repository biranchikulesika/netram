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
