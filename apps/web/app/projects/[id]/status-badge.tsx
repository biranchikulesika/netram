import type { ProjectStatus } from "@netram/types";

function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const normalized = status.toLowerCase().replace(/\s+/g, "_");
  return <span className={`status status-${normalized}`}>{formatStatus(status)}</span>;
}

