import { Platform } from "react-native";

/**
 * Netram Design System Tokens
 * Source of truth: DESIGN.md & apps/web/globals.css
 */
export const colors = {
  // Canvas & Background Colors
  bgCanvas: "#f6f8fc",
  bgSurface: "#ffffff",
  bgSubtle: "#f3f6fb",
  bgHover: "#edf2fa",
  backdrop: "#001a38",

  // Institutional Navy & Brand
  navyDark: "#002449",
  navyBrand: "#0c2a52",
  navyData: "#1c3a63",
  navyLight: "#9fc0e8",

  // Text Colors
  textPrimary: "#0c2a52",
  textData: "#1c3a63",
  textMuted: "#475569",
  textSubtle: "#64748b",
  textInverse: "#ffffff",

  // Structural Blue & Borders
  accentBlue: "#3a488b",
  borderSubtle: "#e2e8f0",
  borderStrong: "#cbd5e1",

  // Functional & Status Colors
  actionGreen: "#15803d",
  actionGreenDark: "#0e7a34",
  tagRust: "#c2410c",
  tagRustDark: "#a5340a",
  error: "#dc2626",
  errorBg: "#fef2f2",
  errorBorder: "#fecaca",
  gold: "#f59e0b",
  goldDark: "#d97706",
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
