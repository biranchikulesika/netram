import { redirect } from "next/navigation";
import { getClient, getSessionUser } from "../../../lib/api";
import { NavHeader } from "../../components/nav-header";
import { AttendanceOverviewSection } from "../control-room/attendance-overview";
import type { AttendanceCalculation } from "@netram/types";

export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Seeded monitoring day - the attendance overview/calculations sample dataset lands here. */
const DEFAULT_DATE = "2026-09-12";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; q?: string }>;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const params = await searchParams;
  const date =
    params.date && DATE_PATTERN.test(params.date) ? params.date : DEFAULT_DATE;
  const searchQuery = params.q?.trim() ?? "";

  const client = await getClient();
  const range = { from: date, to: date };

  const [attendanceCalculationsPage, attendanceAnomalies] =
    await Promise.all([
      client
        .listAttendanceCalculations({ ...range, pageSize: 50 })
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
        calculations={attendanceCalculations.items}
        anomalies={attendanceAnomalies.items}
        selectedDate={date}
        initialSearch={searchQuery}
      />
    </main>
  );
}
