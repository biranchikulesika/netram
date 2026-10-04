import Link from "next/link";
import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../../../lib/api";
import { NavHeader } from "../../../components/nav-header";
import { IconAlertTriangle, IconBuilding } from "../../../components/icons";
import { ComplaintDetailClient } from "./complaint-detail-client";

export const dynamic = "force-dynamic";

export default async function ComplaintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const permissions = Array.isArray(session?.permissions) ? session.permissions : [];
  const isAuthorized = permissions.includes("complaint:read") || permissions.includes("*");

  if (!isAuthorized) {
    return (
      <main>
        <NavHeader
          userEmail={session.user.email}
          permissionsCount={permissions.length}
          permissions={permissions}
          activeSection="complaints"
        />

        <div
          className="table-card"
          style={{
            padding: "2.5rem 1.5rem",
            maxWidth: "480px",
            margin: "3rem auto",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "var(--tint-red)",
              color: "#dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem auto",
            }}
          >
            <IconAlertTriangle style={{ width: 22, height: 22 }} />
          </div>

          <h3
            style={{
              margin: "0 0 0.5rem 0",
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "var(--color-navy-brand)",
            }}
          >
            Access Restricted
          </h3>
          <p
            className="muted"
            style={{ fontSize: "0.85rem", lineHeight: 1.5, margin: "0 0 1.25rem 0" }}
          >
            Your official account does not have authorization to view grievance records.
          </p>

          <Link
            href="/dashboard/complaints"
            className="btn-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
          >
            <span>Return to Complaints</span>
          </Link>
        </div>
      </main>
    );
  }

  const client = await getClient();
  const complaint = await client.getComplaint(id).catch(() => null);

  if (!complaint) {
    return (
      <main>
        <NavHeader
          userEmail={session.user.email}
          permissionsCount={permissions.length}
          permissions={permissions}
          activeSection="complaints"
        />

        <div
          className="table-card"
          style={{
            padding: "2.5rem 1.5rem",
            maxWidth: "480px",
            margin: "3rem auto",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "#edf0f5",
              color: "var(--text-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem auto",
            }}
          >
            <IconBuilding style={{ width: 22, height: 22 }} />
          </div>

          <h3
            style={{
              margin: "0 0 0.5rem 0",
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "var(--color-navy-brand)",
            }}
          >
            Grievance Not Found
          </h3>
          <p
            className="muted"
            style={{ fontSize: "0.85rem", lineHeight: 1.5, margin: "0 0 1.25rem 0" }}
          >
            The requested grievance record does not exist or is not within your district
            jurisdiction.
          </p>

          <Link
            href="/dashboard/complaints"
            className="btn-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
          >
            <span>&larr; Return to Complaints</span>
          </Link>
        </div>
      </main>
    );
  }

  const canResolve = permissions.includes("complaint:resolve") || permissions.includes("*");

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={permissions.length}
        permissions={permissions}
        activeSection="complaints"
      />

      <ComplaintDetailClient initialComplaint={complaint} canResolve={canResolve} />
    </main>
  );
}
