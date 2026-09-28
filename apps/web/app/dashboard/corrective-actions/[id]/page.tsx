import Link from "next/link";
import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../../../lib/api";
import { NavHeader } from "../../../components/nav-header";
import { IconAlertTriangle, IconBuilding } from "../../../components/icons";
import { CorrectiveActionDetailClient } from "./corrective-action-detail-client";

export const dynamic = "force-dynamic";

export default async function CorrectiveActionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const permissions = Array.isArray(session?.permissions) ? session.permissions : [];
  const isAuthorized =
    permissions.includes("corrective_action:read") || permissions.includes("*");

  if (!isAuthorized) {
    return (
      <main>
        <NavHeader
          userEmail={session.user.email}
          permissionsCount={permissions.length}
          permissions={permissions}
          activeSection="corrective-actions"
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
            Your official account does not have authorization to view corrective action records.
          </p>

          <Link
            href="/dashboard/corrective-actions"
            className="btn-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
          >
            <span>Return to Corrective Actions</span>
          </Link>
        </div>
      </main>
    );
  }

  const client = await getClient();
  const action = await client.getCorrectiveAction(id).catch(() => null);

  if (!action) {
    return (
      <main>
        <NavHeader
          userEmail={session.user.email}
          permissionsCount={permissions.length}
          permissions={permissions}
          activeSection="corrective-actions"
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
            Corrective Action Not Found
          </h3>
          <p
            className="muted"
            style={{ fontSize: "0.85rem", lineHeight: 1.5, margin: "0 0 1.25rem 0" }}
          >
            The requested corrective action does not exist or is not accessible within your jurisdiction.
          </p>

          <Link
            href="/dashboard/corrective-actions"
            className="btn-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
          >
            <span>&larr; Return to Corrective Actions</span>
          </Link>
        </div>
      </main>
    );
  }

  const [inspection, findings] = await Promise.all([
    client.getInspection(action.inspectionId).catch(() => null),
    client.listFindings(action.inspectionId).catch(() => []),
  ]);

  const project = inspection
    ? await client.getProject(inspection.projectId).catch(() => null)
    : null;

  const finding = findings.find((f) => f.id === action.findingId) || null;

  const canSubmitAtr = permissions.includes("corrective_action:submit") || permissions.includes("*");
  const canReview = permissions.includes("corrective_action:approve") || permissions.includes("*");

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={permissions.length}
        permissions={permissions}
        activeSection="corrective-actions"
      />

      <CorrectiveActionDetailClient
        initialAction={action}
        finding={finding}
        project={project}
        canSubmitAtr={canSubmitAtr}
        canReview={canReview}
      />
    </main>
  );
}
