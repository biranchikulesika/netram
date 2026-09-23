import type { AttendanceCalculation } from "@netram/types";
import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../../../../lib/api";
import { NavHeader } from "../../../../components/nav-header";
import { IconClipboard } from "../../../../components/icons";
import { AttendanceYearCalendar } from "./attendance-year-calendar";

export const dynamic = "force-dynamic";

const YEAR_PATTERN = /^\d{4}$/;
const PAGE_SIZE = 100;

async function fetchAllCalculations(
  client: Awaited<ReturnType<typeof getClient>>,
  projectId: string,
): Promise<AttendanceCalculation[]> {
  const all: AttendanceCalculation[] = [];
  for (let page = 1; page <= 20; page += 1) {
    try {
      const res = await client.listAttendanceCalculations({ projectId, page, pageSize: PAGE_SIZE });
      all.push(...res.items);
      if (res.items.length < PAGE_SIZE) break;
    } catch {
      break;
    }
  }
  return all;
}

export default async function AttendanceRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { projectId } = await params;
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const permissions = Array.isArray(session?.permissions) ? session.permissions : [];
  const canRead =
    permissions.includes("attendance:monitor:read") ||
    permissions.includes("attendance:individual:read") ||
    permissions.includes("*");

  if (!canRead) {
    return (
      <main>
        <NavHeader
          userEmail={session.user.email}
          permissionsCount={permissions.length}
          permissions={permissions}
          activeSection="attendance"
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
            <IconClipboard style={{ width: 22, height: 22 }} />
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
          <p className="muted" style={{ fontSize: "0.85rem", lineHeight: 1.5, margin: 0 }}>
            Your official account does not have authorization to view attendance records.
          </p>
        </div>
      </main>
    );
  }

  const sp = await searchParams;
  const currentYear = new Date().getFullYear();

  const client = await getClient();
  const [project, calculations] = await Promise.all([
    client.getProject(projectId).catch(() => null),
    fetchAllCalculations(client, projectId),
  ]);

  const dataYears = calculations.map((c) => Number(c.operationalDate.slice(0, 4)));
  const minYear = dataYears.length ? Math.min(...dataYears) : currentYear;
  const maxYear = dataYears.length ? Math.max(...dataYears) : currentYear;
  const firstYear = minYear - 1;
  const lastYear = Math.min(maxYear, currentYear);

  const year =
    sp.year && YEAR_PATTERN.test(sp.year) ? Number(sp.year) : Math.min(currentYear, maxYear);

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={permissions.length}
        permissions={permissions}
        activeSection="attendance"
      />

      <div style={{ padding: "0 1rem" }}>
        <AttendanceYearCalendar
          year={year}
          calculations={calculations}
          firstYear={firstYear}
          lastYear={lastYear}
          projectName={project?.name}
          projectCode={project?.code}
        />
      </div>
    </main>
  );
}