import type { ProjectStatus } from "@netram/types";

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <span className="status">{status}</span>;
}
