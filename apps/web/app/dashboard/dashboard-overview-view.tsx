import Link from "next/link";
import { IconCalendar, IconCheck, IconFileText } from "../components/icons";
import type {
  ActivityEntry,
  AttentionItem,
  AttentionSeverity,
  StateMetric,
  UpcomingItem,
} from "./overview-model";
import { relativeAge } from "./overview-model";

/** Severity dot colours, matching the attention rows on the project page. */
const SEVERITY_TONE: Record<AttentionSeverity, string> = {
  critical: "#dc2626",
  high: "#dd501e",
  medium: "#dd501e",
};

export interface DashboardOverviewViewProps {
  attention: AttentionItem[];
  metrics: StateMetric[];
  upcoming: UpcomingItem[];
  activity: ActivityEntry[];
  /** False when the API refused the audit list, so the feed is unknown. */
  activityReadable: boolean;
  /** Server render time, so ages never disagree with the fetched data. */
  now: number;
}

/**
 * The operations overview answers four questions and stops: what needs
 * attention, what the state is, what changed, what is next. It reuses the
 * portal's own surfaces (table cards, table rows, badges, micro-labels, empty
 * states) so it reads as part of the product rather than beside it.
 */
export function DashboardOverviewView({
  attention,
  metrics,
  upcoming,
  activity,
  activityReadable,
  now,
}: DashboardOverviewViewProps) {
  return (
    <div>
      {/* 1. What the current state is. */}
      <div>
        {/* Figures as type, not cards: no container, no border, no shadow. The
            house micro-label and figure styles carry it, separated by space
            alone so nothing re-boxes at any width. */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(128px, 1fr))",
            gap: "1.25rem",
            marginBottom: "1.5rem",
            paddingTop: "0.15rem",
          }}
        >
          {metrics.map((metric) => (
            <Link key={metric.id} href={metric.href} style={{ textDecoration: "none" }}>
              {/* An unreadable list is unknown, not zero: never present a figure
                  the signed-in user was not permitted to obtain. */}
              <span
                className="kpi-val"
                style={{
                  display: "block",
                  fontSize: "3.5rem",
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                  // Rust for the one figure that means work exists; muted for a
                  // figure the server refused, so a big dash never reads as data.
                  color: metric.highlight
                    ? "var(--tag-rust)"
                    : metric.readable
                      ? undefined
                      : "var(--text-muted)",
                }}
              >
                {metric.readable ? metric.value : "-"}
              </span>
              <span
                className="kpi-label"
                style={{
                  display: "block",
                  marginTop: "0.4rem",
                  lineHeight: 1.35,
                  // 0.6875rem micro-type is too small to carry a sentence.
                  fontSize: "0.75rem",
                }}
              >
                {metric.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* 2. What needs attention. */}
      <section aria-labelledby="needs-attention-heading">
        <div className="section-title-row">
          <h3 id="needs-attention-heading">Needs Attention</h3>
        </div>

        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Severity</th>
                <th>Facility</th>
                <th>What needs attention</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {attention.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table-empty-state">
                    <IconCheck width={22} height={22} className="table-empty-icon" />
                    <div className="table-empty-title">Nothing needs attention</div>
                    <div className="table-empty-desc">
                      Scheduled inspections, corrective actions and complaints are all within their
                      expected state in your jurisdiction.
                    </div>
                  </td>
                </tr>
              ) : (
                attention.map((item) => (
                  <tr key={item.id} className="table-row">
                    <td>
                      {/* Severity as a bare word: no chip, no dot. The word is
                          the meaning; the tone only reinforces it. */}
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          color: SEVERITY_TONE[item.severity],
                        }}
                      >
                        {item.severity}
                      </span>
                    </td>
                    <td>
                      <Link href={item.href} className="table-name-link" title="Open record">
                        {item.title}
                      </Link>
                    </td>
                    <td>{item.reason}</td>
                    <td className="table-date">{item.meta ?? "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3 & 4. What changed, and what is coming next. */}
      <div className="section-pair-grid">
        <section aria-labelledby="recent-activity-heading">
          <div className="section-title-row">
            <h3 id="recent-activity-heading">Recent Activity</h3>
            {activityReadable && (
              <Link href="/dashboard/audit" className="btn-secondary">
                View all
              </Link>
            )}
          </div>

          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Change</th>
                  <th>Status</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {activity.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="table-empty-state">
                      <IconFileText width={22} height={22} className="table-empty-icon" />
                      <div className="table-empty-title">
                        {activityReadable
                          ? "No recorded activity yet"
                          : "Activity history restricted"}
                      </div>
                      <div className="table-empty-desc">
                        {activityReadable
                          ? "Inspections, corrective actions and complaints recorded in your jurisdiction will appear here."
                          : "Your account does not have authorization to view the activity log."}
                      </div>
                    </td>
                  </tr>
                ) : (
                  activity.map((entry) => (
                    <tr key={entry.id} className="table-row">
                      <td>
                        <span className="table-name-link" style={{ cursor: "default" }}>
                          {entry.summary}
                        </span>
                        {entry.subject && <div className="table-subtext">{entry.subject}</div>}
                      </td>
                      <td className="table-subtext" style={{ whiteSpace: "nowrap" }}>
                        {entry.status}
                      </td>
                      <td className="table-date">{relativeAge(entry.occurredAt, now)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="upcoming-heading">
          <div className="section-title-row">
            <h3 id="upcoming-heading">Upcoming</h3>
            <Link href="/dashboard/inspections" className="btn-secondary">
              View all
            </Link>
          </div>

          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Facility</th>
                  <th>Inspection</th>
                  <th>Scheduled</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="table-empty-state">
                      <IconCalendar width={22} height={22} className="table-empty-icon" />
                      <div className="table-empty-title">Nothing scheduled ahead</div>
                      <div className="table-empty-desc">
                        No future inspections are assigned in your jurisdiction.
                      </div>
                    </td>
                  </tr>
                ) : (
                  upcoming.map((item) => (
                    <tr key={item.id} className="table-row">
                      <td>
                        <Link href={item.href} className="table-name-link">
                          {item.projectName}
                        </Link>
                      </td>
                      <td>
                        <span className="table-type">{item.kind}</span>
                      </td>
                      <td className="table-date">{item.when}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
