# Netram Design System Specification

This document defines the authoritative visual language, colour palette, typography, and styling rules for the Netram platform across **all web applications (`apps/web`) and mobile applications (`apps/inspector-mobile`)**.

Netram is a **mission-critical public-sector product** built for the Department of Social Justice & Empowerment (DoSJE), Government of India. 

> ### 🏛️ Core Principle: Government Product Standards
> * **Zero decorative animation**: Strictly no bouncy animations, floating elements, spinning loops, or distracting micro-animations.
> * **Zero over-styling**: Strictly no aggressive glassmorphism, decorative rainbow gradients, or oversized cartoonish rounded corners.
> * **High legibility & trust**: Subdued, crisp, authoritative institutional layouts with strict WCAG AA contrast compliance.
> * **Consistency**: Every feature, screen, modal, and mobile workflow must adhere to these tokens.

---

## 1. Official Colour Palette

The colour system is derived from the official Netram portal identity:

### 1.1 Canvas & Background Colours

| Token Name | Hex Code | Purpose & Usage |
| :--- | :--- | :--- |
| `--color-bg-canvas` | `#f6f8fc` | **Primary application background**. Soft, clean grey-blue tint. |
| `--color-bg-surface` | `#ffffff` | Primary cards, content panels, modals, and input fields. |
| `--color-bg-subtle` | `#f3f6fb` | Table headers, metadata key columns, badge backgrounds, and inactive panels. |
| `--color-bg-hover` | `#edf2fa` | Interactive row hover, list item hover, and secondary button hover. |
| `--color-backdrop` | `#001a38` | Modal/dialog scrim backdrop (applied with `rgba(0, 26, 56, 0.55)`). |

### 1.2 Institutional Navy & Text Colours

| Token Name | Hex Code | Purpose & Usage |
| :--- | :--- | :--- |
| `--color-navy-dark` | `#002449` | Deepest institutional navy. Header accents, institution badges. |
| `--color-text-primary` | `#0c2a52` | **Primary text colour**. Headings, card titles, prominent labels. |
| `--color-text-data` | `#1c3a63` | Data values in tables, definition lists, and formal metrics. |
| `--color-text-muted` | `#475569` | Body copy, descriptions, explanatory text (slate-600). |
| `--color-text-subtle` | `#64748b` | Timestamps, field hints, secondary metadata (slate-500). |
| `--color-navy-light` | `#9fc0e8` | Subtitle text on dark navy surfaces (`#002449`). |

### 1.3 Structural Accents & Dividers

| Token Name | Hex Code | Purpose & Usage |
| :--- | :--- | :--- |
| `--color-accent-blue` | `#3a488b` | Structural section headers, active borders, uppercase category tags. |
| `--color-border-subtle` | `#e2e8f0` | Standard card borders, table dividers, panel outlines (slate-200). |
| `--color-border-strong` | `#cbd5e1` | Input field borders, active card borders on hover (slate-300). |

### 1.4 Functional & Status Colours

| Token Name | Hex Code | Purpose & Usage |
| :--- | :--- | :--- |
| `--color-action-green` | `#15803d` | **Primary Action / Verification**. Sign in buttons, submit actions. |
| `--color-action-green-dark` | `#0e7a34` | Darker bound for green buttons (`from-[#15803d] to-[#0e7a34]`). |
| `--color-tag-rust` | `#c2410c` | Status tags, ID badges (`#26095`), alert bullets, priority tags. |
| `--color-tag-rust-dark` | `#a5340a` | Darker bound for rust badges (`from-[#c2410c] to-[#a5340a]`). |
| `--color-error` | `#dc2626` | Validation errors, critical rejection alerts, negative findings. |

---

## 2. Typography Specification

### 2.1 Font Families

1. **Primary Interface Font**:
   ```css
   font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
   ```
   * Used for all UI text, headings, buttons, body paragraphs, and forms.
   * Always apply `antialiased` rendering (`-webkit-font-smoothing: antialiased`).

2. **Technical / Monospace Font**:
   ```css
   font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace;
   ```
   * Used for:
     * Problem Statement / Project IDs (e.g., `#26095`, `PRJ-2026-001`)
     * Deadlines, timestamps, and dates
     * Section category headers (uppercase tracking)
     * Definition list metadata keys (`dt` elements)
     * Version identifiers (`v1.0.0`)

### 2.2 Typographic Hierarchy

* **Page / View Title**: `28px - 36px` (`1.75rem - 2.25rem`), font-weight `700` or `800`, tracking `tight` (`-0.025em`), colour `#0c2a52`.
* **Section / Card Heading**: `18px - 22px` (`1.125rem - 1.375rem`), font-weight `600` or `700`, colour `#0c2a52`.
* **Section Eyebrow / Tag**: `10px - 11px`, `font-mono`, uppercase, letter-spacing `0.15em - 0.2em`, colour `#3a488b`, font-weight `600`.
* **Body Text**: `14px - 15px` (`0.875rem - 0.9375rem`), font-weight `400` or `500`, line-height `1.5 - 1.6`, colour `#475569`.
* **Technical Labels / Keys**: `10px - 11px`, `font-mono`, uppercase, letter-spacing `0.15em`, colour `#475569`, background `#f3f6fb`.
* **Form Inputs & Buttons**: `15px - 16px` (ensuring 16px on mobile to prevent iOS viewport auto-zoom), font-weight `500` - `600`.

---

## 3. UI Component Patterns

### 3.1 Buttons

* **Primary Action Button**:
  * Background: Solid or subtle linear gradient from `#15803d` to `#0e7a34`.
  * Text: `#ffffff`, font-weight `600`, 14px - 15px.
  * Border radius: `8px` (inputs/cards) or pill `9999px` (landing actions).
  * Focus state: `outline: 2px solid #86efac`, `outline-offset: 2px`.
  * Hover: `brightness(1.08)` (no scale bounce or physical distortion).

* **Secondary / Neutral Button**:
  * Background: `#f3f6fb` (hover: `#edf2fa`).
  * Border: `1px solid #cbd5e1` (hover: `#3a488b`).
  * Text: `#0c2a52`, font-weight `600`.

### 3.2 Form Inputs

* Background: `#ffffff`.
* Border: `1px solid #cbd5e1`.
* Text: `#0c2a52` (placeholder: `#94a3b8`).
* Focus ring: `outline: none; border-color: #3a488b; box-shadow: 0 0 0 2px rgba(58, 72, 139, 0.2);`.
* Error state: `border-color: #dc2626; box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.15);`.

### 3.3 Cards & Data Tables

* Card background: `#ffffff`.
* Border: `1px solid #e2e8f0`.
* Border radius: `8px` to `12px` (restrained, clean).
* Box shadow: `0 1px 3px rgba(12, 42, 82, 0.04), 0 4px 12px rgba(12, 42, 82, 0.03)` (subtle, crisp elevation).
* Table header: Background `#f3f6fb`, border-bottom `1px solid #e2e8f0`, text `font-mono text-[10px] uppercase text-[#475569]`.
* Table cell: Text `#1c3a63`, border-bottom `1px solid #e2e8f0`.

### 3.4 Badges & Status Chips

* **ID / Reference Badge**: Background gradient `from-[#c2410c] to-[#a5340a]`, text `#ffffff`, `font-mono`, uppercase, letter-spacing `0.1em`.
* **Institutional Badge**: Background `#002449`, text `#ffffff`, `font-semibold`.
* **Standard Status Pill**: Background `#f3f6fb`, border `1px solid #e2e8f0`, text `#475569`.

---

## 4. CSS Custom Properties Reference

Add these tokens to root CSS variables (`globals.css` / theme root):

```css
:root {
  /* Canvas & Backgrounds */
  --bg-canvas: #f6f8fc;
  --bg-surface: #ffffff;
  --bg-subtle: #f3f6fb;
  --bg-hover: #edf2fa;
  --bg-backdrop: rgba(0, 26, 56, 0.55);

  /* Deep Navy & Primary Brand */
  --color-navy-dark: #002449;
  --color-navy-brand: #0c2a52;
  --color-navy-data: #1c3a63;
  --color-navy-light: #9fc0e8;

  /* Structural Blue & Borders */
  --color-accent-blue: #3a488b;
  --color-border-subtle: #e2e8f0;
  --color-border-strong: #cbd5e1;

  /* Text Colors */
  --text-primary: #0c2a52;
  --text-data: #1c3a63;
  --text-muted: #475569;
  --text-subtle: #64748b;

  /* Functional Accents */
  --action-green: #15803d;
  --action-green-dark: #0e7a34;
  --tag-rust: #c2410c;
  --tag-rust-dark: #a5340a;
  --color-error: #dc2626;

  /* Typography */
  --font-sans: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace;
}
```

---

## 5. Engineering Constraints & Rules

1. **No animations**: Do not introduce CSS `@keyframes` for floating, bouncing, pulse glows, or entry slide effects.
2. **Transition limits**: Transitions are strictly limited to simple state changes (e.g. `color 0.15s ease`, `background-color 0.15s ease`, `border-color 0.15s ease`).
3. **No gratuitous rounded shapes**: Avoid 24px+ bubble radii on content cards; standard cards must use 8px to 12px.
4. **Contrast compliance**: Always ensure text on `--bg-canvas` (`#f6f8fc`) uses `--text-primary` (`#0c2a52`) or `--text-muted` (`#475569`).
5. **Cross-platform parity**: Mobile inspector UI components (`apps/inspector-mobile`) must use the same hex values and typography hierarchy.
