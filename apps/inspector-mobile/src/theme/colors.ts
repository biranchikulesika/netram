import { Platform } from "react-native";

/**
 * Netram Design System Tokens
 * Source of truth: DESIGN.md & apps/web/globals.css
 */
export const colors = {
  // Canvas & Background Colours (DESIGN.md §1.1 & web globals.css parity)
  bgCanvas: "#ffffff",
  bgSurface: "#ffffff",
  bgSubtle: "#edf0f5",
  bgHover: "#edf0f5",
  backdrop: "rgba(0, 36, 73, 0.55)",

  // Institutional Navy & Brand (DESIGN.md §1.2 & web globals.css parity)
  navyDark: "#002449",
  navyBrand: "#0c2a52",
  navyData: "#0c2a52",
  navyLight: "#edf0f5",

  // Text Colours (DESIGN.md §1.2 & web globals.css parity)
  textPrimary: "#0c2a52",
  textData: "#0c2a52",
  textMuted: "#45556c",
  textSubtle: "#45556c",
  textInverse: "#ffffff",

  // Structural Navy & Borders (DESIGN.md §1.3 & web globals.css parity)
  accentBlue: "#0c2a52",
  borderSubtle: "#edf0f5",
  borderStrong: "#45556c",

  // Functional & Status Colours (DESIGN.md §1.4 & web globals.css parity)
  actionGreen: "#137e3a",
  actionGreenDark: "#137e3a",
  tagRust: "#dd501e",
  tagRustDark: "#dd501e",
  error: "#dc2626",
  errorBg: "#fef2f2",
  errorBorder: "#fecaca",
  gold: "#dd501e",
  goldDark: "#dd501e",

  // Harmonised Surface Variants (DESIGN.md compliant)
  darkBg: "#ffffff",
  darkSurface: "#ffffff",
  darkBorder: "#edf0f5",
  darkTextPrimary: "#0c2a52",
  darkTextSecondary: "#45556c",
  darkAccent: "#002449",
  darkAccentLight: "#0c2a52",
  tealAccent: "#137e3a",
  warningAmber: "#dd501e",
  errorRed: "#dc2626",
  successGreen: "#137e3a",
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
