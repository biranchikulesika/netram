import Link from "next/link";
import { notFound } from "next/navigation";
import { getCachedSessionUser } from "../../../../lib/api";
import { canAny } from "../../../../lib/permissions";
import {
  getFacility,
  getFacilityAttendance,
  getFacilityComplaints,
  getFacilityCorrectiveActions,
  getFacilityInspections,
  getFacilityPhotos,
  getUserNames,
} from "../../../../lib/facility";
import { formatDate, formatShortDate } from "../../../../lib/presentation";
import { IconChevronRight } from "../../../components/icons";
import { PhotoGallery } from "./photo-gallery";

export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = new Set(["in_progress", "evidence_collection"]);
const REVIEW_STATUSES = new Set([
  "submitted",
  "under_review",
  "findings",
  "corrective_actions",
  "verification",
]);
const CA_ALERT_STATUSES = new Set(["overdue", "escalated", "pending"]);

interface AttentionRow {
  key: string;
  tone: string;
  title: string;
  sub: string;
  pill: string;
  pillSerious: boolean;
  href: string;
}

/**
 * Facility overview - the minimal, permission-aware hub.
 *
 * Every fetch below is gated on the caller's permissions BEFORE the request is
 * made: data the caller cannot see is never fetched, never serialized, never
 * sent (§34 - omission, not hiding). Sections with no visible data simply do
 * not exist for that viewer.
 */
export default async function FacilityOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getFacility(id);
  if (!project) notFound();

  const session = await getCachedSessionUser();
  const permissions = session?.permissions ?? [];
  const canSee = (required: readonly string[]) => canAny(permissions, required);

  const [canSeeInspections, canSeeComplaints, canSeeAttendance, canSeeActions] = [
    canSee(["inspection:read"]),
    canSee(["complaint:read"]),
    canSee(["attendance:monitor:read"]),
    canSee(["corrective_action:read"]),
  ] as const;

  const [inspections, complaints, attendance, correctiveActions, photos, userNames] =
    await Promise.all([
      canSeeInspections ? getFacilityInspections(project.id) : Promise.resolve([]),
      canSeeComplaints ? getFacilityComplaints(project.id) : Promise.resolve([]),
      canSeeAttendance
        ? getFacilityAttendance(project.id)
        : Promise.resolve({ overview: [], anomalies: [] }),
      canSeeActions ? getFacilityCorrectiveActions(project.id) : Promise.resolve([]),
      getFacilityPhotos(project.id),
      getUserNames(),
    ]);

  const activeInspections = inspections.filter((i) => ACTIVE_STATUSES.has(i.status));
  const reviewInspections = inspections.filter((i) => REVIEW_STATUSES.has(i.status));

  const openComplaints = complaints.filter((c) => c.status !== "resolved" && c.status !== "closed");
  const openAttendanceAnomalies = attendance.anomalies.filter(
    (a) => !["DISMISSED", "FALSE_POSITIVE", "ACTIONED"].includes(a.state),
  );
  const outstandingActions = correctiveActions.filter((ca) => ca.status !== "accepted");

  const rows: AttentionRow[] = [];

  if (canSeeActions) {
    for (const ca of outstandingActions
      .filter((ca) => CA_ALERT_STATUSES.has(ca.status))
      .slice(0, 3)) {
      rows.push({
        key: `ca-${ca.id}`,
        tone: "#dc2626",
        title: `Corrective action ${ca.status.replace("_", " ")}`,
        sub: `Deadline ${formatShortDate(ca.deadline)} · linked to inspection findings`,
        pill: ca.status === "overdue" ? "Overdue" : ca.status.replace("_", " "),
        pillSerious: ca.status === "overdue" || ca.status === "escalated",
        href: `/dashboard/projects/${project.id}/actions`,
      });
    }
  }

  if (canSeeInspections) {
    for (const i of activeInspections.slice(0, 3)) {
      rows.push({
        key: `inspect-${i.id}`,
        tone: "#0c2a52",
        title: `${i.type === "surprise" ? "Surprise" : "Routine"} inspection in the field`,
        sub: `Started ${formatShortDate(i.startedAt ?? i.scheduledStart)} · ${i.trigger.replace(/_/g, " ")}`,
        pill: "In the field",
        pillSerious: false,
        href: `/dashboard/projects/${project.id}/inspections`,
      });
    }

    for (const i of reviewInspections.slice(0, 2)) {
      rows.push({
        key: `review-${i.id}`,
        tone: "#dd501e",
        title: `${i.type === "surprise" ? "Surprise" : "Routine"} inspection awaiting review`,
        sub: `Submitted ${formatShortDate(i.submittedAt ?? i.updatedAt)}`,
        pill: "Awaiting review",
        pillSerious: false,
        href: `/dashboard/projects/${project.id}/inspections`,
      });
    }
  }

  if (canSeeComplaints) {
    for (const c of openComplaints.slice(0, 3)) {
      rows.push({
        key: `comp-${c.id}`,
        tone: "#dc2626",
        title: `Complaint ${c.trackingCode}`,
        sub: `${c.description}`,
        pill: c.status.replace(/_/g, " "),
        pillSerious: false,
        href: `/dashboard/projects/${project.id}/complaints`,
      });
    }
  }

  if (canSeeAttendance) {
    for (const a of openAttendanceAnomalies.slice(0, 3)) {
      rows.push({
        key: `att-${a.id}`,
        tone: "#dd501e",
        title: `Attendance signal: ${a.anomalyType.replace(/_/g, " ").toLowerCase()}`,
        sub: `Observed ${formatShortDate(a.observationStart)} · ${Math.round(a.score * 100)}% score`,
        pill: a.state.replace(/_/g, " "),
        pillSerious: false,
        href: `/dashboard/projects/${project.id}/attendance`,
      });
    }
  }

  /**
   * Facility facts the masthead does not already show, grouped in reading
   * order: what the facility runs under (programme) → where it stands in its
   * lifecycle (approval, registration, freshness). Empty states are muted,
   * not absent.
   */
  // Deduped: programmeIds may repeat a scheme, and React keys must be unique.
  const schemeNames = [...new Set(project.programmeNames ?? [])];

  const factSections: {
    title: string;
    items: {
      label: string;
      value?: string;
      /** Rendered as a bulleted list instead of a single sentence. */
      list?: string[];
      muted?: boolean;
      full?: boolean;
    }[];
  }[] = [
    {
      title: "Programme",
      items: [
        {
          label: "Enrolled Schemes",
          list: schemeNames,
          muted: schemeNames.length === 0,
          full: true,
        },
      ],
    },
    {
      title: "Lifecycle",
      items: [
        {
          label: "Approved",
          value: project.approvedAt
            ? `${formatDate(project.approvedAt)} · ${(project.approvedById && userNames[project.approvedById]) || "Approving authority"}`
            : "Awaiting verification",
          muted: !project.approvedAt,
        },
        { label: "Registered", value: formatDate(project.createdAt) },
        { label: "Last Update", value: formatShortDate(project.updatedAt) },
      ],
    },
  ];

  return (
    <>
      <div className="facility-grid">
        {/* Attention queue */}
        <div className="facility-panel">
          <div className="facility-panel-head">
            <span className="facility-panel-title">Attention</span>
            {rows.length > 0 && (
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                {rows.length} item{rows.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          {rows.length === 0 ? (
            <div className="attention-empty">Nothing needs attention.</div>
          ) : (
            <div className="attention-list">
              {rows.map((row) => (
                <Link
                  key={row.key}
                  href={row.href}
                  className="attention-row"
                  style={{ textDecoration: "none" }}
                >
                  <span
                    className="attention-dot"
                    style={{ background: row.tone }}
                    aria-hidden="true"
                  />
                  <span className="attention-body">
                    <span className="attention-title">{row.title}</span>
                    <span className="attention-sub">{row.sub}</span>
                  </span>
                  <span className={`attention-pill ${row.pillSerious ? "serious" : ""}`}>
                    {row.pill}
                  </span>
                  <IconChevronRight
                    style={{ width: 13, height: 13, flex: "none", color: "var(--text-subtle)" }}
                  />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Facility facts + photos, stacked in one column so the gallery
            matches the facts card width */}
        <div className="facility-facts-column">
          <div className="facility-panel">
            <div className="facility-panel-head">
              <span className="facility-panel-title">Facility Facts</span>
            </div>
            {factSections.map((section) => (
              <div key={section.title} className="ff-section">
                <div className="ff-section-title">{section.title}</div>
                <div className="facility-facts facility-facts-tight">
                  {section.items.map((item) => (
                    <div key={item.label} className={`ff-item ${item.full ? "ff-full" : ""}`}>
                      <span className="ff-label">{item.label}</span>
                      {item.list ? (
                        item.list.length > 0 ? (
                          <ul className="ff-list">
                            {item.list.map((name) => (
                              <li key={name}>{name}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="ff-value ff-empty">None linked</span>
                        )
                      ) : (
                        <span className={`ff-value ${item.muted ? "ff-empty" : ""}`}>
                          {item.value}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <PhotoGallery photos={photos} />
        </div>
      </div>
    </>
  );
}
