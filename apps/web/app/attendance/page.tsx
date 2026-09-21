import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../lib/api";
import { NavHeader } from "../components/nav-header";
import { AttendanceOverviewSection } from "../control-room/attendance-overview";
import type { AttendanceCalculation } from "@netram/types";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const client = await getClient();

  const [attendanceOverview, attendanceCalculationsPage, attendanceAnomalies] =
    await Promise.all([
      client
        .listAttendanceOverview({ pageSize: 50 })
        .catch(() => ({ items: [], total: 0, page: 1, pageSize: 50 })),
      client
        .listAttendanceCalculations({ pageSize: 50 })
        .catch(() => ({ items: [], total: 0, page: 1, pageSize: 50 })),
      client
        .listAttendanceAnomalies({ pageSize: 20 })
        .catch(() => ({ items: [], total: 0, page: 1, pageSize: 20 })),
    ]);

  const attendanceCalculations = attendanceCalculationsPage as unknown as {
    items: AttendanceCalculation[];
  };

  return (
    <main>
      <NavHeader
        userEmail={session.user.email}
        permissionsCount={session.permissions.length}
        permissions={session.permissions}
        activeSection="attendance"
      />

      <AttendanceOverviewSection
        overviewItems={attendanceOverview.items}
        calculations={attendanceCalculations.items}
        anomalies={attendanceAnomalies.items}
      />
    </main>
  );
}
