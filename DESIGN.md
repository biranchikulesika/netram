# Netram Design System Specification

This document defines the authoritative visual language, colour palette, typography, and styling rules for the Netram platform across **all web applications (`apps/web`) and mobile applications (`apps/inspector-mobile`)**.

Netram is a **mission-critical public-sector product** addressing a problem statement from the Department of Social Justice & Empowerment (DoSJE). It is a **Smart India Hackathon 2026 project, not an official Government of India or DoSJE platform**, and no screen, document or metadata may present it as one.

> ### 🏛️ Core Principle: Government Product Standards
>
> - **Zero decorative animation**: Strictly no bouncy animations, floating elements, spinning loops, or distracting micro-animations.
> - **Zero over-styling**: Strictly no aggressive glassmorphism, decorative rainbow gradients, or oversized cartoonish rounded corners.
> - **High legibility & trust**: Subdued, crisp, authoritative institutional layouts with strict WCAG AA contrast compliance.
> - **Consistency**: Every feature, screen, modal, and mobile workflow must adhere to these tokens.

---

## 1. Official Colour Palette (Strict)

Netram uses a **closed 8-colour palette**. These are the ONLY colours permitted in
the web application. No gradients, no additional blues/greens/oranges/greys,
no arbitrary hex values, and no semi-random opacity colours. Colour usage must
be restrained: **white is the primary background**; navy carries identity and
structure; green is the primary action; red is reserved for destructive/error
states only.

### 1.1 The Palette

| Colour            | Hex Code  | Role                                                                                       |
| :---------------- | :-------- | :----------------------------------------------------------------------------------------- |
| **White**         | `#FFFFFF` | Primary background and surfaces. Cards, panels, modals, inputs, tables.                    |
| **Netram Navy**   | `#0C2A52` | Primary brand colour. Headings, primary text, links, info status, primary data-viz slot.   |
| **Deep Navy**     | `#002449` | Dark surfaces: topbars, institutional badges, video scrims, selected rows, shadows/scrims. |
| **Netram Orange** | `#DD501E` | Accent: status tags, ID badges, alert bullets, priority, **warning** status.               |
| **Netram Green**  | `#137E3A` | Primary actions (sign in, submit, verify) and **success** status.                          |
| **Cool Neutral**  | `#45556C` | Secondary text, strong interactive borders, input borders.                                 |
| **Light Neutral** | `#EDF0F5` | Borders, dividers, subtle surfaces, table headers, hover fills.                            |
| **Red**           | `#DC2626` | Critical/destructive/error ONLY. Validation errors, rejections, destructive buttons.       |

### 1.2 Semantic Status Mapping

| Status           | Colour                  | Notes                                                    |
| :--------------- | :---------------------- | :------------------------------------------------------- |
| Success          | Netram Green `#137E3A`  | Verified, approved, acted upon, completed.               |
| Info             | Netram Navy `#0C2A52`   | Reviewed, informational, neutral emphasis.               |
| Warning          | Netram Orange `#DD501E` | Pending, overdue-risk, investigating, priority.          |
| Error / Critical | Red `#DC2626`           | Failed, rejected, critical. **Never used decoratively.** |

**Colour is never the only indicator**: every status must also carry a text label,
icon, or position that identifies it without relying on hue.

### 1.3 Tints and Alpha Variants

The only permitted tints are **alpha (opacity) variants of palette colours**,
exposed in `apps/web/globals.css` as tokens:

| Token           | Value                     | Usage                                          |
| :-------------- | :------------------------ | :--------------------------------------------- |
| `--tint-navy`   | `rgba(12, 42, 82, 0.06)`  | Info/navy-tinted backgrounds, selected states. |
| `--tint-green`  | `rgba(19, 126, 58, 0.08)` | Success-tinted backgrounds.                    |
| `--tint-orange` | `rgba(221, 80, 30, 0.08)` | Warning-tinted backgrounds.                    |
| `--tint-red`    | `rgba(220, 38, 38, 0.08)` | Error-tinted backgrounds.                      |
| `--scrim-video` | `rgba(0, 36, 73, 0.9)`    | Video overlay scrims (control room).           |
| `--bg-backdrop` | `rgba(0, 36, 73, 0.55)`   | Modal/dialog scrims.                           |

Elevation shadows use navy-based alpha (`rgba(12, 42, 82, a)`,
`rgba(0, 36, 73, a)`) - never grey or black.

### 1.4 Data Visualisation Exception

Chart series colours may exceed the palette **only when a chart genuinely
requires more than two distinguishable datasets**. Any such additions must be
restrained, must never leak into UI components, and must be documented here.
Two-series charts must use Navy + Netram Green. Single-series charts use Navy.

### 1.5 Legacy Palette (Removed)

The following are **no longer approved** and were fully removed from the codebase:
canvas `#f6f8fc`, accent blue `#3a488b`, rust `#c2410c`/`#a5340a`, action greens
`#15803d`/`#0e7a34`, data-text `#1c3a63`, muted slate `#475569`/`#64748b`, borders
`#e2e8f0`/`#cbd5e1`, and all Tailwind-style arbitrary hexes (`#2563eb`, `#3b82f6`,
`#10b981`, `#22c55e`, `#f59e0b`, `#6b7280`, `#64748b`, `#ef4444`, etc.).
Any reintroduction is a design-system regression.

---

## 2. Typography Specification

### 2.1 Font Families

1. **Primary Interface Font**:

   ```css
   font-family:
     "Inter",
     system-ui,
     -apple-system,
     BlinkMacSystemFont,
     "Segoe UI",
     Roboto,
     sans-serif;
   ```
   - Used for all UI text, headings, buttons, body paragraphs, and forms.
   - Always apply `antialiased` rendering (`-webkit-font-smoothing: antialiased`).

2. **Technical / Monospace Font**:
   ```css
   font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace;
   ```
   - Used for:
     - Problem Statement / Project IDs (e.g., `#26095`, `PRJ-2026-001`)
     - Deadlines, timestamps, and dates
     - Section category headers (uppercase tracking)
     - Definition list metadata keys (`dt` elements)
     - Version identifiers (`v1.0.0`)

### 2.2 Typographic Hierarchy

- **Page / View Title**: `28px - 36px` (`1.75rem - 2.25rem`), font-weight `700` or `800`, tracking `tight` (`-0.025em`), colour `#0c2a52`.
- **Section / Card Heading**: `18px - 22px` (`1.125rem - 1.375rem`), font-weight `600` or `700`, colour `#0c2a52`.
- **Section Eyebrow / Tag**: `10px - 11px`, `font-mono`, uppercase, letter-spacing `0.15em - 0.2em`, colour `#0c2a52`, font-weight `600`.
- **Body Text**: `14px - 15px` (`0.875rem - 0.9375rem`), font-weight `400` or `500`, line-height `1.5 - 1.6`, colour `#45556c`.
- **Technical Labels / Keys**: `10px - 11px`, `font-mono`, uppercase, letter-spacing `0.15em`, colour `#45556c`, background `#edf0f5`.
- **Form Inputs & Buttons**: `15px - 16px`, font-weight `500` - `600`.

---

## 3. UI Component Patterns

### 3.1 Buttons

Button colours are consistent across the entire application: **green = primary
action**, **navy/neutral = secondary**, **red = destructive only**. No gradients.

- **Primary Action Button**:
  - Background: Solid Netram Green `#137E3A`.
  - Text: `#ffffff`, font-weight `600`, 14px - 15px.
  - Border radius: `8px` (inputs/cards) or pill `9999px` (landing actions).
  - Focus state: `outline: 2px solid var(--action-green)`, `outline-offset: 2px`.
  - Hover: `brightness(1.08)` (no scale bounce or physical distortion).

- **Secondary / Neutral Button**:
  - Background: Light Neutral `#EDF0F5`.
  - Border: `1px solid var(--color-border-strong)` (`#45556C`).
  - Text: Netram Navy `#0c2a52`, font-weight `600`.

- **Destructive Button**:
  - Background: Solid Red `#DC2626`. Used only for irreversible/destructive
    operations (rejections, deletions). Never for emphasis.

### 3.2 Form Inputs

- Background: `#ffffff`.
- Border: `1px solid var(--color-border-strong)` (`#45556C`).
- Text: `#0c2a52` (placeholder: `var(--text-subtle)`, `#45556C`).
- Focus ring: `outline: none; border-color: #0c2a52; box-shadow: 0 0 0 2px rgba(12, 42, 82, 0.2);`.
- Error state: `border-color: #dc2626; box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.15);`.

### 3.3 Cards & Data Tables

- Card background: `#ffffff`.
- Border: `1px solid var(--color-border-subtle)` (`#EDF0F5`).
- Border radius: `8px` to `12px` (restrained, clean).
- Box shadow: `0 1px 3px rgba(12, 42, 82, 0.04), 0 4px 12px rgba(12, 42, 82, 0.03)` (subtle, crisp, navy-based elevation).
- **Tables are monochromatic**: white body rows, Light Neutral `#EDF0F5` headers,
  navy text; no coloured row backgrounds except alpha tints for status.
- Table header: Background `#edf0f5`, border-bottom `1px solid #edf0f5`, text uppercase `#45556C`.
- Table cell: Text `#0c2a52`, border-bottom `1px solid #edf0f5`.

### 3.4 Badges & Status Chips

- **ID / Reference Badge**: Background Netram Orange `#DD501E`, text `#ffffff`,
  `font-mono`, uppercase, letter-spacing `0.1em`. No gradients.
- **Institutional Badge**: Background Deep Navy `#002449`, text `#ffffff`, `font-semibold`.
- **Standard Status Pill**: Background `#edf0f5`, border `1px solid #edf0f5`, text `#45556C`.
- **Semantic Status Pills**: alpha tint background + palette colour text per §1.2
  (e.g. `var(--tint-red)` + `#dc2626`), always paired with a text label.

---

## 4. CSS Custom Properties Reference

Add these tokens to root CSS variables (`globals.css` / theme root). These are
implemented in `apps/web/globals.css` and are the **only** sanctioned colour
channel for web UI code - prefer `var(…)` tokens over raw hex in component code.

```css
:root {
  /* The 8 approved colours */
  --color-white: #ffffff;
  --color-navy-brand: #0c2a52; /* Netram Navy */
  --color-navy-dark: #002449; /* Deep Navy */
  --color-orange: #dd501e; /* Netram Orange */
  --action-green: #137e3a; /* Netram Green */
  --color-neutral-cool: #45556c; /* Cool Neutral */
  --color-neutral-light: #edf0f5; /* Light Neutral */
  --color-error: #dc2626; /* Red */

  /* Canvas & Surfaces (white primary background) */
  --bg-canvas: #ffffff;
  --bg-surface: #ffffff;
  --bg-subtle: #edf0f5;
  --bg-hover: #edf0f5;
  --bg-backdrop: rgba(0, 36, 73, 0.55);

  /* Borders */
  --color-border-subtle: #edf0f5;
  --color-border-strong: #45556c;

  /* Text */
  --text-primary: #0c2a52;
  --text-data: #0c2a52;
  --text-muted: #45556c;
  --text-subtle: #45556c;

  /* Actions & Status */
  --action-green: #137e3a;
  --tag-rust: #dd501e;
  --color-warning: #dd501e;
  --color-error: #dc2626;

  /* Alpha tints - the only permitted colour variants */
  --tint-navy: rgba(12, 42, 82, 0.06);
  --tint-green: rgba(19, 126, 58, 0.08);
  --tint-orange: rgba(221, 80, 30, 0.08);
  --tint-red: rgba(220, 38, 38, 0.08);
  --scrim-video: rgba(0, 36, 73, 0.9);

  /* Typography */
  --font-sans:
    "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace;
}
```

### 4.1 Enforcement Notes

- Component code should consume tokens (`var(--action-green)`), not raw hex.
- Inline `style` colours in TSX must resolve to the palette - no `#2563eb`,
  `bg-emerald-600`, `rgba(59, 130, 246, …)` style values, etc.
- No CSS gradients are used for decoration; video overlay scrims are the only
  permitted alpha overlays (`--scrim-video`, `--bg-backdrop`).

---

## 5. Engineering Constraints & Rules

1. **No animations**: Do not introduce CSS `@keyframes` for floating, bouncing, pulse glows, or entry slide effects.
2. **Transition limits**: Transitions are strictly limited to simple state changes (e.g. `color 0.15s ease`, `background-color 0.15s ease`, `border-color 0.15s ease`).
3. **No gratuitous rounded shapes**: Avoid 24px+ bubble radii on content cards; standard cards must use 8px to 12px.
4. **Contrast compliance**: Always ensure text on `--bg-canvas` (`#ffffff`) uses `--text-primary` (`#0c2a52`) or `--text-muted` (`#45556c`).
5. **Cross-platform parity**: Mobile inspector UI components (`apps/inspector-mobile`) must use the same palette values and typography hierarchy.
6. **Closed palette**: The 8 colours in §1.1 are the complete set. Every new UI surface must be expressible with them; if one genuinely cannot, that is an architectural decision requiring a DESIGN.md update first - never a local hex literal.
