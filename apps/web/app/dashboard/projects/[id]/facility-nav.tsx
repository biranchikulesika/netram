"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ProjectStatus } from "@netram/types";
import {
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconClipboard,
  IconGrid,
  IconLock,
  IconVideo,
  IconIndianRupee,
} from "../../../components/icons";
import { TransitionButton } from "./transition-button";

interface FacilityNavItem {
  href: string;
  label: string;
  icon: (props: { width?: number | string; height?: number | string }) => React.ReactNode;
  /** Any-of permission gate; omitted = visible to everyone who can see the facility. */
  permission?: string | string[];
}

interface FacilityNavProps {
  projectId: string;
  permissions: string[];
  currentStatus?: ProjectStatus;
}

/**
 * Facility contextual navigation ("which aspect of this facility am I
 * examining?"). This is NOT the global sidebar ("which system area am I working
 * in?") — both coexist by design (§CORE IA).
 *
 * Tabs mirror the global sidepanel sections and mirror the API's own
 * permission gates: a caller without the permission never sees the tab, and
 * the corresponding page never fetches the data at all (§34 — omission, not
 * hiding).
 */
export function FacilityNav({ projectId, permissions, currentStatus }: FacilityNavProps) {
  const pathname = usePathname();
  const base = `/dashboard/projects/${projectId}`;

  const canTransition =
    Boolean(currentStatus) &&
    (permissions.includes("project:transition") ||
      permissions.includes("project:approve") ||
      permissions.includes("*"));

  // Tab order follows the facility lifecycle: identity → money →
  // oversight (inspections, remediation, grievances) → daily operations →
  // technical signals → append-only audit record. Risk appears only as the
  // header health gauge (authority-only), not as a tab. Contact details live
  // on the overview's Facility Facts card.
  const items: FacilityNavItem[] = [
    { href: base, label: "Overview", icon: IconGrid },
    { href: `${base}/funds`, label: "Funds", icon: IconIndianRupee, permission: ["fund:read", "expense:read"] },
    { href: `${base}/inspections`, label: "Inspections", icon: IconClipboard, permission: "inspection:read" },
    { href: `${base}/actions`, label: "Corrections", icon: IconCheck, permission: "corrective_action:read" },
    { href: `${base}/complaints`, label: "Complaints", icon: IconAlertTriangle, permission: "complaint:read" },
    {
      href: `${base}/attendance`,
      label: "Attendance",
      icon: IconClock,
      permission: "attendance:monitor:read",
    },
    {
      href: `${base}/monitoring`,
      label: "Monitoring",
      icon: IconVideo,
      permission: ["cctv:read", "ai:anomaly:read"],
    },
    { href: `${base}/activity`, label: "Activity", icon: IconLock, permission: "audit:read" },
  ];

  const visible = items.filter((item) => {
    if (!item.permission) return true;
    if (permissions.includes("*")) return true;
    const required = Array.isArray(item.permission) ? item.permission : [item.permission];
    return required.some((perm) => permissions.includes(perm));
  });

  const isActive = (href: string) =>
    href === base ? pathname === base : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="facility-nav" aria-label="Facility sections">
      <div className="facility-nav-links">
        {visible.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`facility-nav-link ${isActive(item.href) ? "active" : ""}`}
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              <Icon width={13} height={13} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
      {canTransition && currentStatus && (
        <div className="facility-nav-transition">
          <TransitionButton projectId={projectId} currentStatus={currentStatus} />
        </div>
      )}
    </nav>
  );
}
