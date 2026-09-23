"use client";

import { useMemo, useState } from "react";
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
  projectName?: string | null;
  projectCode?: string | null;
}

interface Record {
  present: number;
  absent: number | null;
}

export function AttendanceYearCalendar({ year, calculations, projectName, projectCode }: AttendanceYearCalendarProps) {
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
    for (const r of byDate.values()) {
      recorded += 1;
      present += r.present;
      absent += r.absent ?? 0;
    }
    const avg = recorded > 0 ? (present / recorded).toFixed(1) : "—";
    return { recorded, present, absent, avg };
  }, [byDate]);

  const router = useRouter();
  const pathname = usePathname();
  const goYear = (target: number) => router.push(`${pathname}?year=${target}`);

  const currentYear = new Date().getFullYear();
  const [windowStart, setWindowStart] = useState(currentYear - 4);

  const windowYears = [0, 1, 2, 3, 4].map((i) => windowStart + i);

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
          <h1
            style={{
              margin: 0,
              fontSize: "1.15rem",
              fontWeight: 700,
              color: "var(--color-navy-brand)",
            }}
          >
            {projectName ?? "Attendance Record"}
            {projectCode && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--text-subtle)",
                  marginLeft: "0.6rem",
                  letterSpacing: "0.03em",
                }}
              >
                {projectCode}
              </span>
            )}
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", whiteSpace: "nowrap" }}>
            <button
              type="button"
              style={yearArrowStyle}
              title={`Show earlier years`}
              aria-label="Show earlier years"
              disabled={windowStart <= currentYear - 5}
              onClick={() => setWindowStart((w) => w - 1)}
            >
              ‹
            </button>
            {windowYears.map((y) => {
              const active = y === year;
              return (
                <button
                  key={y}
                  type="button"
                  style={{ ...yearStripStyle, ...(active ? yearStripActiveStyle : {}) }}
                  aria-pressed={active}
                  aria-label={`Show ${y} record`}
                  onClick={() => goYear(y)}
                >
                  {y}
                </button>
              );
            })}
            <button
              type="button"
              style={yearArrowStyle}
              title={`Show later years`}
              aria-label="Show later years"
              disabled={windowStart >= currentYear}
              onClick={() => setWindowStart((w) => w + 1)}
            >
              ›
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
            <Stat num={summary.recorded} label="days recorded" color="#334155" />
            <Stat num={summary.avg} label="avg present/day" color="#334155" decimal />
          </div>
        </div>
      </div>

      {/* Year grid: 12 monthly mini-calendars in a 4 x 3 grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1rem",
        }}
      >
        {MONTHS.map((name, monthIdx) => (
          <MonthGrid key={name} name={name} monthIdx={monthIdx} year={year} byDate={byDate} />
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
        <LegendDot color="#dcfce7" label="High attendance (≥ 90%)" />
        <LegendDot color="#fef9c3" label="Reduced (70–89%)" />
        <LegendDot color="#fee2e2" label="Low (< 70%)" />
        <LegendDot color="#f1f5f9" label="No record" />
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
          border: "1px solid #e2e8f0",
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
        border: "1px solid #e2e8f0",
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
          const bg =
            rate === null
              ? "#f1f5f9"
              : rate >= 0.9
                ? "#dcfce7"
                : rate >= 0.7
                  ? "#fef9c3"
                  : "#fee2e2";
          return (
            <div
              key={iso}
              title={
                r
                  ? `${iso}: ${r.present} present${r.absent !== null ? `, ${r.absent} absent` : ""}`
                  : `${iso}: no record`
              }
              style={{
                aspectRatio: "1",
                borderRadius: "4px",
                background: bg,
                border: "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.63rem",
                lineHeight: 1.1,
                fontWeight: 600,
                color: rate === null ? "#94a3b8" : rate >= 0.7 ? "#166534" : "#b91c1c",
                cursor: "default",
              }}
            >
              <span style={{ opacity: 0.75 }}>{Number(iso.slice(8, 10))}</span>
              {r && (
                <span style={{ opacity: 0.85 }}>
                  {r.present}/{r.absent ?? "?"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ num, label, color, decimal = false }: { num: number | string; label: string; color: string; decimal?: boolean }) {
  const display =
    typeof num === "number"
      ? decimal ? num.toFixed(1) : num.toLocaleString("en-IN")
      : num;
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: "0.35rem" }}>
      <strong style={{ fontSize: "0.95rem", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{display}</strong>
      <span className="muted" style={{ fontSize: "0.72rem" }}>{label}</span>
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
  color: "#334155",
  cursor: "pointer",
  padding: "0.1rem 0.2rem",
};

const yearStripStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  fontWeight: 600,
  color: "#64748b",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: "0.1rem 0.35rem",
};

const yearStripActiveStyle: React.CSSProperties = {
  color: "#4338ca",
  fontWeight: 700,
  textDecoration: "underline",
  textUnderlineOffset: "3px",
};