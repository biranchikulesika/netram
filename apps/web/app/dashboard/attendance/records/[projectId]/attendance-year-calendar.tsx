"use client";

import { useMemo, useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AttendanceCalculation } from "@netram/types";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface AttendanceYearCalendarProps {
  year: number;
  calculations: AttendanceCalculation[];
  firstYear: number;
  lastYear: number;
  projectName?: string | null;
  projectCode?: string | null;
  title?: string;
  hideProjectIdentity?: boolean;
}

interface Record {
  present: number;
  absent: number | null;
}

export function AttendanceYearCalendar({
  year,
  calculations,
  firstYear,
  lastYear,
  projectName,
  projectCode,
  title,
  hideProjectIdentity = false,
}: AttendanceYearCalendarProps) {
  const [selectedYear, setSelectedYear] = useState(year);

  useEffect(() => {
    setSelectedYear(year);
  }, [year]);

  const byDate = useMemo(() => {
    const m = new Map<string, Record>();
    for (const c of calculations) {
      const existing = m.get(c.operationalDate);
      if (existing) {
        existing.present += c.present;
        if (c.absent !== null) existing.absent = (existing.absent ?? 0) + c.absent;
      } else {
        m.set(c.operationalDate, { present: c.present, absent: c.absent });
      }
    }
    return m;
  }, [calculations]);

  const summary = useMemo(() => {
    let recorded = 0;
    let present = 0;
    let absent = 0;
    const yearPrefix = `${selectedYear}-`;
    for (const [date, r] of byDate.entries()) {
      if (!date.startsWith(yearPrefix)) continue;
      recorded += 1;
      present += r.present;
      absent += r.absent ?? 0;
    }
    const avg = recorded > 0 ? (present / recorded).toFixed(1) : "-";
    return { recorded, present, absent, avg };
  }, [byDate, selectedYear]);

  const router = useRouter();
  const pathname = usePathname();
  const goYear = (target: number) => {
    setSelectedYear(target);
    router.push(`${pathname}?year=${target}`, { scroll: false });
  };

  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i);

  return (
    <div>
      {/* Header: project identity left, year nav + summary right */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "1.25rem",
        }}
      >
        <div>
          {hideProjectIdentity ? (
            <h2
              style={{
                margin: 0,
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "var(--color-navy-brand)",
              }}
            >
              {title ?? "Attendance Calendar"}
            </h2>
          ) : (
            <h1
              style={{
                margin: 0,
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "var(--color-navy-brand)",
              }}
            >
              {title ?? projectName ?? "Attendance Record"}
              {projectCode && (
                <span
                  style={{
                    fontSize: "0.825rem",
                    fontWeight: 600,
                    color: "var(--text-subtle)",
                    marginLeft: "0.6rem",
                  }}
                >
                  {projectCode}
                </span>
              )}
            </h1>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.6rem", whiteSpace: "nowrap" }}
          >
            <button
              type="button"
              style={yearArrowStyle}
              title="Previous year"
              aria-label="Previous year"
              disabled={selectedYear <= firstYear}
              onClick={() => goYear(selectedYear - 1)}
            >
              ‹
            </button>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                whiteSpace: "nowrap",
                fontSize: "0.9rem",
                fontWeight: 600,
                color: "var(--text-subtle)",
              }}
            >
              {years
                .map((y) => (
                  <button
                    key={y}
                    type="button"
                    style={{
                      ...yearStripStyle,
                      ...(y === selectedYear ? yearStripActiveStyle : {}),
                    }}
                    aria-pressed={y === selectedYear}
                    aria-label={`Show ${y} record`}
                    onClick={() => goYear(y)}
                  >
                    {y}
                  </button>
                ))
                .flatMap((el, i) =>
                  i === 0
                    ? [el]
                    : [
                        <span
                          key={`sep-${i}`}
                          style={{
                            color: "var(--color-border-strong)",
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            padding: "0 0.45rem",
                          }}
                        >
                          |
                        </span>,
                        el,
                      ],
                )}
            </div>
            <button
              type="button"
              style={yearArrowStyle}
              title="Next year"
              aria-label="Next year"
              disabled={selectedYear >= lastYear}
              onClick={() => goYear(selectedYear + 1)}
            >
              ›
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
            <Stat num={summary.recorded} label="days recorded" color="var(--text-muted)" />
            <Stat num={summary.avg} label="avg present/day" color="var(--text-muted)" decimal />
          </div>
        </div>
      </div>

      {/* Year grid: 12 monthly mini-calendars in a responsive grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "1rem",
        }}
      >
        {MONTHS.map((name, monthIdx) => (
          <MonthGrid
            key={name}
            name={name}
            monthIdx={monthIdx}
            year={selectedYear}
            byDate={byDate}
          />
        ))}
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1.2rem",
          flexWrap: "wrap",
          marginTop: "1.25rem",
          paddingTop: "1rem",
          borderTop: "1px solid var(--color-border-subtle)",
          fontSize: "0.75rem",
          color: "var(--text-muted)",
        }}
      >
        <LegendDot color="var(--tint-green)" label="High attendance (≥ 90%)" />
        <LegendDot color="var(--tint-orange)" label="Reduced (70–89%)" />
        <LegendDot color="var(--tint-red)" label="Low (< 70%)" />
        <LegendDot color="#edf0f5" label="No record" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 3,
          background: color,
          border: "1px solid var(--color-border-subtle)",
          display: "inline-block",
        }}
      />
      {label}
    </span>
  );
}

function MonthGrid({
  name,
  monthIdx,
  year,
  byDate,
}: {
  name: string;
  monthIdx: number;
  year: number;
  byDate: Map<string, Record>;
}) {
  const cells = useMemo(() => {
    const firstDay = new Date(year, monthIdx, 1).getDay();
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    const out: (string | null)[] = [];
    for (let i = 0; i < firstDay; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = new Date(Date.UTC(year, monthIdx, d)).toISOString().slice(0, 10);
      out.push(iso);
    }
    return out;
  }, [year, monthIdx]);

  const monthSummary = useMemo(() => {
    let recorded = 0;
    for (const iso of cells) {
      if (!iso) continue;
      if (byDate.get(iso)) recorded += 1;
    }
    return { recorded };
  }, [cells, byDate]);

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid var(--color-border-subtle)",
        borderRadius: "8px",
        padding: "0.85rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.5rem",
        }}
      >
        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--color-navy-brand)" }}>
          {name}
        </span>
        <span className="muted" style={{ fontSize: "0.72rem" }}>
          {monthSummary.recorded} day{monthSummary.recorded === 1 ? "" : "s"}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "2px",
        }}
      >
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            style={{
              fontSize: "0.6rem",
              fontWeight: 600,
              color: "var(--text-subtle)",
              textAlign: "center",
              paddingBottom: "2px",
            }}
          >
            {w}
          </div>
        ))}
        {cells.map((iso, idx) => {
          if (!iso) return <div key={`e-${idx}`} />;
          const r = byDate.get(iso);
          const present = r?.present ?? 0;
          const absent = r?.absent ?? 0;
          const expected = present + absent;
          const rate = expected > 0 ? present / expected : null;
          const severity =
            rate === null ? "none" : rate >= 0.9 ? "high" : rate >= 0.7 ? "reduced" : "low";
          const meta = {
            high: { bg: "var(--tint-green)", border: "var(--tint-green)", text: "#137e3a" },
            reduced: { bg: "var(--tint-orange)", border: "var(--tint-orange)", text: "#dd501e" },
            low: { bg: "var(--tint-red)", border: "var(--tint-red)", text: "#dc2626" },
            none: {
              bg: "#edf0f5",
              border: "var(--color-border-subtle)",
              text: "var(--text-subtle)",
            },
          }[severity];
          const cellStyle: React.CSSProperties = {
            aspectRatio: "1",
            borderRadius: "6px",
            background: meta.bg,
            border: `1px solid ${meta.border}`,
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1px",
            paddingTop: "0.55rem",
            overflow: "hidden",
          };
          const cellInner = (
            <>
              <span
                style={{
                  position: "absolute",
                  top: 2,
                  left: 4,
                  fontSize: "0.52rem",
                  fontWeight: 600,
                  color: "var(--text-subtle)",
                  lineHeight: 1,
                }}
              >
                {Number(iso.slice(8, 10))}
              </span>
              {r ? (
                <span
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    lineHeight: 1.15,
                    marginTop: "0.2rem",
                    color: meta.text,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {present}
                </span>
              ) : (
                <span
                  style={{ fontSize: "0.55rem", color: "var(--text-subtle)", marginTop: "0.2rem" }}
                >
                  -
                </span>
              )}
            </>
          );
          return (
            <div
              key={iso}
              title={`${iso}${r ? `: ${present} present` : ": no record"}`}
              style={cellStyle}
            >
              {cellInner}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({
  num,
  label,
  color,
  decimal = false,
}: {
  num: number | string;
  label: string;
  color: string;
  decimal?: boolean;
}) {
  const display =
    typeof num === "number" ? (decimal ? num.toFixed(1) : num.toLocaleString("en-IN")) : num;
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: "0.35rem" }}>
      <strong
        style={{ fontSize: "0.95rem", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}
      >
        {display}
      </strong>
      <span className="muted" style={{ fontSize: "0.72rem" }}>
        {label}
      </span>
    </span>
  );
}

const yearArrowStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  background: "transparent",
  fontSize: "1rem",
  fontWeight: 700,
  lineHeight: 1,
  color: "var(--text-muted)",
  cursor: "pointer",
  padding: "0.1rem 0.2rem",
};

const yearStripStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  fontWeight: 600,
  color: "var(--text-subtle)",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: "0.15rem 0.55rem",
};

const yearStripActiveStyle: React.CSSProperties = {
  color: "#ffffff",
  background: "#0c2a52",
  borderRadius: "999px",
  fontWeight: 700,
};
