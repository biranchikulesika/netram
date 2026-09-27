import { notFound } from "next/navigation";
import { getFacility, getFacilityAttendanceCalculations } from "../../../../../lib/facility";
import { getSessionUser } from "../../../../../lib/api";
import { can } from "../../../../../lib/permissions";
import { AttendanceYearCalendar } from "../../../attendance/records/[projectId]/attendance-year-calendar";

export const dynamic = "force-dynamic";

const YEAR_PATTERN = /^\d{4}$/;

export default async function FacilityAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await getSessionUser();
  if (
    !session ||
    (!can(session.permissions, "attendance:monitor:read") &&
      !can(session.permissions, "attendance:individual:read") &&
      !can(session.permissions, "*"))
  ) {
    notFound();
  }

  const { id } = await params;
  const project = await getFacility(id);
  if (!project) return null;

  const sp = await searchParams;
  const currentYear = new Date().getFullYear();

  const calculations = await getFacilityAttendanceCalculations(project.id);

  const dataYears = calculations.map((c) => Number(c.operationalDate.slice(0, 4)));
  const minYear = dataYears.length ? Math.min(...dataYears) : currentYear;
  const maxYear = dataYears.length ? Math.max(...dataYears) : currentYear;
  const firstYear = minYear - 1;
  const lastYear = Math.min(maxYear, currentYear);

  const year =
    sp.year && YEAR_PATTERN.test(sp.year) ? Number(sp.year) : Math.min(currentYear, maxYear);

  return (
    <section>
      <AttendanceYearCalendar
        year={year}
        calculations={calculations}
        firstYear={firstYear}
        lastYear={lastYear}
        hideProjectIdentity={true}
        title="Attendance Calendar"
      />
    </section>
  );
}