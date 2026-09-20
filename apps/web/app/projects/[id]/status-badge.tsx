import type { ProjectStatus } from "@netram/types";

function formatStatus(status: string): string {
  if (status === "Pending Verification" || status === "pending_verification") {
    return "Pending";
  }
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({
  status,
  className,
}: {
  status: ProjectStatus;
  className?: string;
}) {
  const normalized = status.toLowerCase().replace(/\s+/g, "_");
  return (
    <span
      className={`status status-${normalized} ${className || ""}`}
      title={`Status: ${status}`}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "currentColor",
          display: "inline-block",
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
      <span>{formatStatus(status)}</span>
    </span>
  );
}


