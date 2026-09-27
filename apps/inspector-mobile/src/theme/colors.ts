import { Platform } from "react-native";

/**
 * Netram Design System Tokens
 * Source of truth: DESIGN.md & apps/web/globals.css
 */
export const colors = {
  // Canvas & Background Colors (DESIGN.md §1.1)
  bgCanvas: "#f6f8fc",
  bgSurface: "#ffffff",
  bgSubtle: "#f3f6fb",
  bgHover: "#edf2fa",
  backdrop: "#001a38",

  // Institutional Navy & Brand (DESIGN.md §1.2)
  navyDark: "#002449",
  navyBrand: "#0c2a52",
  navyData: "#1c3a63",
  navyLight: "#9fc0e8",

  // Text Colors (DESIGN.md §1.2)
  textPrimary: "#0c2a52",
  textData: "#1c3a63",
  textMuted: "#475569",
  textSubtle: "#64748b",
  textInverse: "#ffffff",

  // Structural Blue & Borders (DESIGN.md §1.3)
  accentBlue: "#3a488b",
  borderSubtle: "#e2e8f0",
  borderStrong: "#cbd5e1",

  // Functional & Status Colors (DESIGN.md §1.4)
  actionGreen: "#15803d",
  actionGreenDark: "#0e7a34",
  tagRust: "#c2410c",
  tagRustDark: "#a5340a",
  error: "#dc2626",
  errorBg: "#fef2f2",
  errorBorder: "#fecaca",
  gold: "#f59e0b",
  goldDark: "#d97706",

  // Harmonized Surface Variants (DESIGN.md compliant)
  darkBg: "#f6f8fc",
  darkSurface: "#ffffff",
  darkBorder: "#e2e8f0",
  darkTextPrimary: "#0c2a52",
  darkTextSecondary: "#475569",
  darkAccent: "#002449",
  darkAccentLight: "#3a488b",
  tealAccent: "#15803d",
  warningAmber: "#f59e0b",
  errorRed: "#dc2626",
  successGreen: "#15803d",
} as const;

export const typography = {
  sans: Platform.select({
    ios: "System",
    android: "Roboto",
    default: "sans-serif",
  }),
  mono: Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
  }),
} as const;

/** Consistent spacing scale (4-base grid) */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  "3xl": 32,
} as const;

/** Border-radius scale */
export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;
