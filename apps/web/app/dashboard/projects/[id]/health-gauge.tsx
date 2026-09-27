import type { ProjectRiskSnapshot } from "@netram/types";

/**
 * Facility health gauge (semicircle meter, credit-score idiom).
 *
 * health = 100 − composite risk score: high health reads green, low health
 * red, with the needle sitting on a continuous red→amber→green gradient track.
 *
 * Advisory only (§36): this is a rendered view of the project-risk engine's
 * latest snapshot, never an administrative verdict. Rendered exclusively for
 * viewers holding `project_risk:read` — the score is never sent to anyone
 * else (§34: omission, not hiding).
 */

interface HealthGaugeProps {
  snapshot: ProjectRiskSnapshot | null;
}

/** Semicircle gauge geometry: 180° arc from 0 (left) to 100 (right). */
const RADIUS = 54;
const CX = 64;
const CY = 62;
/** Pivot hub radius — solid disk carrying the score at the needle's rotation point. */
const HUB_RADIUS = 18;

/** Point on the arc for a 0–100 score (0° = left, 180° = right). */
function arcPoint(score: number): { x: number; y: number } {
  const angleDeg = Math.min(100, Math.max(0, score)) * 1.8;
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CX - RADIUS * Math.cos(rad),
    y: CY - RADIUS * Math.sin(rad),
  };
}

/**
 * Where a score sits along the gradient axis (0–1). The track gradient is a
 * straight left→right axis while the arc's x is a cosine of the score, so
 * every colour is sampled through this rather than by hand.
 */
export function gradientOffset(score: number): number {
  return (arcPoint(score).x - (CX - RADIUS)) / (2 * RADIUS);
}

/**
 * The one health ramp: red at score 0 (left), amber at score 50 (upright),
 * green at score 100 (right). The SVG track and every solid element read these
 * same stops, so a score can never be painted in two hues — the arc beneath
 * the needle, the needle, the hub and the status dot always agree.
 */
const RAMP_RED = "#dc2626";
const RAMP_AMBER = "#eab308";
const RAMP_GREEN = "#16a34a";
/** Score 50 sits exactly mid-axis, so this is the ramp's middle stop. */
const RAMP_MID = gradientOffset(50);

function mixColor(from: string, to: string, t: number): string {
  const channel = (shift: number) => {
    const a = Number.parseInt(from.slice(shift, shift + 2), 16);
    const b = Number.parseInt(to.slice(shift, shift + 2), 16);
    return Math.round(a + (b - a) * t).toString(16).padStart(2, "0");
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

/** Colour of `score` on the ramp, matching how SVG interpolates the track. */
export function rampColor(score: number): string {
  const at = gradientOffset(score);
  return at <= RAMP_MID
    ? mixColor(RAMP_RED, RAMP_AMBER, at / RAMP_MID)
    : mixColor(RAMP_AMBER, RAMP_GREEN, (at - RAMP_MID) / (1 - RAMP_MID));
}

function arcPath(from: number, to: number): string {
  const start = arcPoint(from);
  const end = arcPoint(to);
  const largeArc = (to - from) * 1.8 > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export function HealthGauge({ snapshot }: HealthGaugeProps) {
  // No snapshot yet: show the gauge as pending, never as a score.
  const risk = snapshot ? Math.round(Math.min(100, Math.max(0, snapshot.totalScore))) : null;
  const health = risk === null ? null : 100 - risk;
  const color = health === null ? "#94a3b8" : rampColor(health);

  // Needle sweep in gauge coordinates: 0 = left, 90 = upright, 180 = right.
  // Rendering offsets by −90° because the unrotated needle points up.
  const needleDeg = health === null ? 90 : (health / 100) * 180;

  const statusLabel =
    health === null
      ? "Pending"
      : health >= 75
        ? "Healthy"
        : health >= 50
          ? "Fair"
          : health >= 25
            ? "Strained"
            : "Critical";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        userSelect: "none",
        cursor: "help",
      }}
      // The score and its band live here rather than in permanent text under
      // the meter: hovering the gauge explains it, and the aria-label keeps the
      // same words for assistive tech.
      title={
        health === null
          ? "Health pending — awaiting the first scheduled risk evaluation"
          : `Health ${health}/100 · ${statusLabel} — the inverse of the advisory composite risk score (${risk}/100). An input to oversight prioritisation, never a verdict.`
      }
    >
      {" "}
      <svg
        width="128"
        height="88"
        viewBox="0 0 128 88"
        role="img"
        aria-label={`Health score: ${statusLabel}`}
      >
        <defs>
          {/* The one health ramp, with stops on the gradient axis at the arc's
              own score landmarks so the solid needle/hub colour and the arc
              directly beneath it are the same hue at every score. */}
          <linearGradient
            id="health-track-gradient"
            gradientUnits="userSpaceOnUse"
            x1={CX - RADIUS}
            y1={CY}
            x2={CX + RADIUS}
            y2={CY}
          >
            <stop offset="0" stopColor={RAMP_RED} />
            <stop offset={RAMP_MID} stopColor={RAMP_AMBER} />
            <stop offset="1" stopColor={RAMP_GREEN} />
          </linearGradient>
        </defs>
        {/* Unfilled remainder of the sweep: the same ramp, dimmed well back so
            the full scale stays readable while the filled arc reads as the
            saturated stretch. */}
        <path
          d={arcPath(0, 100)}
          stroke="url(#health-track-gradient)"
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          opacity={0.3}
        />
        {/*
          * Filled stretch from 0 to the current health. Painted with the SAME
          * ramp as the track — a solid status colour here would stripe the
          * low-health end in the opposite hue (a green bar across the red
          * segment). userSpaceOnUse keeps both arcs on one spectrum.
          */}
        {health !== null && (
          <path
            d={arcPath(0, health)}
            stroke="url(#health-track-gradient)"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
          />
        )}
        {/*
         * Needle — tapered blade, drawn pointing up and rotated by
         * needleDeg − 90 so the tip lands on the track at the exact score
         * position (0 → left, 50 → up, 100 → right). The tip reaches 2px inside
         * the 9px track band, so it meets the scale instead of stopping short.
         */}
        {health !== null && (
          <g transform={`rotate(${needleDeg - 90} ${CX} ${CY})`}>
            <polygon
              points={`${CX - 4},${CY + 6} ${CX + 4},${CY + 6} ${CX + 1.2},${CY - RADIUS + 2} ${CX - 1.2},${CY - RADIUS + 2}`}
              fill={color}
              stroke="none"
            />
            <circle cx={CX} cy={CY - RADIUS + 2} r={1.6} fill={color} />
          </g>
        )}
        {/* Pivot hub — solid disk carrying the score at the rotation point */}
        <circle cx={CX} cy={CY} r={HUB_RADIUS} fill={color} />
        <text
          x={CX}
          y={CY}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="15"
          fontWeight="800"
          fill="#ffffff"
          style={{ fontFamily: "var(--font-mono, monospace)" }}
        >
          {health ?? "—"}
        </text>
      </svg>
    </div>
  );
}
