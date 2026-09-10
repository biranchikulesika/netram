import Link from "next/link";
import { SignOutButton } from "../projects/sign-out";

export interface NavHeaderProps {
  userEmail: string;
  permissionsCount: number;
  activeSection:
    | "projects"
    | "inspections"
    | "control-room"
    | "notifications"
    | "complaints"
    | "reports"
    | "audit"
    | "admin"
    | "corrective-actions";
}

const NAV_LINKS: Array<{ href: string; label: string; section: NavHeaderProps["activeSection"] }> = [
  { href: "/projects", label: "Projects", section: "projects" },
  { href: "/inspections", label: "Inspections", section: "inspections" },
  { href: "/control-room", label: "Control Room", section: "control-room" },
  { href: "/corrective-actions", label: "Corrective Actions", section: "corrective-actions" },
  { href: "/complaints", label: "Complaints", section: "complaints" },
  { href: "/reports", label: "Reports", section: "reports" },
  { href: "/audit", label: "Audit", section: "audit" },
  { href: "/notifications", label: "Notifications", section: "notifications" },
  { href: "/admin", label: "Admin", section: "admin" },
];

export function NavHeader({ userEmail, permissionsCount, activeSection }: NavHeaderProps) {
  return (
    <header className="netram-nav">
      <div className="netram-brand">
        <div className="brand-badge">DoSJE</div>
        <div>
          <h1 className="brand-title">Netram</h1>
          <p className="brand-subtitle">Smart Monitoring & Inspection</p>
        </div>
      </div>

      <nav className="nav-links">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-link ${activeSection === link.section ? "active" : ""}`}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="user-profile">
        <div className="user-info">
          <span className="user-email">{userEmail}</span>
          <span className="user-permissions">{permissionsCount} permissions</span>
        </div>
        <SignOutButton />
      </div>
    </header>
  );
}