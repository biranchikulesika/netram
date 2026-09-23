import Link from "next/link";
import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../../lib/api";
import { NavHeader } from "../../components/nav-header";
import { IconAlertTriangle, IconBuilding } from "../../components/icons";
import { AnalyticsView } from "./analytics-view";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ districtId?: string; fromDate?: string; toDate?: string }>;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const permissions = Array.isArray(session?.permissions) ? session.permissions : [];
  const isAuthorized =
    permissions.includes("report:read") ||
    permissions.includes("project:read") ||
    permissions.includes("*");

  if (!isAuthorized) {
    return (
      <main>
        <NavHeader
          userEmail={session.user.email}
          permissionsCount={permissions.length}
          permissions={permissions}
          activeSection="analytics"
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
              background: "#fee2e2",
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
              color: "var(--color-navy-brand, #0f172a)",
            }}
          >
            Access Restricted
          </h3>
          <p className="muted" style={{ fontSize: "0.85rem", lineHeight: 1.5, margin: "0 0 1.25rem 0" }}>
            Your official role assignment lacks statutory oversight permissions (requires{" "}
            <code>report:read</code> or <code>project:read</code>). Contact your administrative supervisor if elevated jurisdiction access is needed.
          </p>

          <Link
            href="/dashboard/projects"
            className="button button-outline"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem" }}
          >
            <IconBuilding style={{ width: 14, height: 14 }} /> Back to Projects
          </Link>
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const client = await getClient();

  const overview = await client
    .getAnalyticsOverview({
      districtId: params.districtId,
      fromDate: params.fromDate,
      toDate: params.toDate,
    })
    .catch((err) => {
      console.error("Failed to load authority analytics overview:", err);
      return {
        summary: {
          totalProjects: 0,
          activeProjects: 0,
          totalInspections: 0,
          closedInspections: 0,
          averageClosureDays: 0,
          totalCorrectiveActions: 0,
          resolvedCorrectiveActions: 0,
          overdueCorrectiveActions: 0,
          overallSlaComplianceRate: 100,
          totalComplaints: 0,
          resolvedComplaints: 0,
          complaintRedressalRate: 100,
          totalFindings: 0,
          criticalFindingsCount: 0,
        },
        slaComplianceByJurisdiction: [],
        deficiencyRecurrence: [],
        inspectionClosureVelocity: {
          totalInspections: 0,
          closedInspections: 0,
          inProgressInspections: 0,
          underReviewInspections: 0,
          averageClosureDays: 0,
          velocityByJurisdiction: [],
        },
        generatedAt: new Date().toISOString(),
      };
    });

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={permissions.length}
        permissions={permissions}
        activeSection="analytics"
      />

      <AnalyticsView
        initialOverview={overview}
        selectedDistrictId={params.districtId ?? ""}
        userEmail={session.user.email}
      />
    </main>
  );
}
