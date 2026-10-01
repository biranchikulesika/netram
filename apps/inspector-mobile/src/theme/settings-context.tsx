import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { colors as defaultLightColors } from "./colors";

export type ThemeMode = "light" | "dark" | "system";
export type AppLanguage = "en" | "hi" | "or" | "bn";
export type FontSizeScale = "standard" | "large";
export type AutoLockTimeout = "immediate" | "5min" | "15min" | "never";

export interface AppSettings {
  themeMode: ThemeMode;
  language: AppLanguage;
  fontSize: FontSizeScale;
  geofenceAlert: boolean;
  offlineMapPreload: boolean;
  highAccuracyGps: boolean;
  cameraQuality: "1080p" | "720p";
  autoGeotag: boolean;
  shutterFeedback: boolean;
  wifiOnlySync: boolean;
  biometricLock: boolean;
  autoLockTimeout: AutoLockTimeout;
}

export const pureDarkColors = {
  // Pure Pitch Black AMOLED Backgrounds (never navy)
  bgCanvas: "#000000",
  bgSurface: "#121212",
  bgSubtle: "#18181B",
  bgHover: "#27272A",
  backdrop: "#000000",

  // In dark mode, titles that were dark navy become crisp white and neutral tones
  navyDark: "#FFFFFF",
  navyBrand: "#F4F4F5",
  navyData: "#E4E4E7",
  navyLight: "#27272A",

  // Text Colors
  textPrimary: "#FFFFFF",
  textData: "#E4E4E7",
  textMuted: "#A1A1AA",
  textSubtle: "#71717A",
  textInverse: "#000000",

  // Structural Blue & Borders
  accentBlue: "#3B82F6",
  borderSubtle: "#27272A",
  borderStrong: "#3F3F46",

  // Functional & Status Colors
  actionGreen: "#22C55E",
  actionGreenDark: "#16A34A",
  tagRust: "#F97316",
  tagRustDark: "#EA580C",
  error: "#EF4444",
  errorBg: "#450A0A",
  errorBorder: "#7F1D1D",
  gold: "#F59E0B",
  goldDark: "#D97706",

  // Harmonized Surface Variants
  darkBg: "#000000",
  darkSurface: "#121212",
  darkBorder: "#27272A",
  darkTextPrimary: "#FFFFFF",
  darkTextSecondary: "#A1A1AA",
  darkAccent: "#3B82F6",
  darkAccentLight: "#60A5FA",
  tealAccent: "#22C55E",
  warningAmber: "#F59E0B",
  errorRed: "#EF4444",
  successGreen: "#22C55E",

  // Extra convenience aliases
  cardBg: "#121212",
  topBarBg: "#0A0A0A",
  inputBg: "#18181B",
} as const;

export type ThemeColors = typeof defaultLightColors | typeof pureDarkColors;

export const defaultSettings: AppSettings = {
  themeMode: "light",
  language: "en",
  fontSize: "standard",
  geofenceAlert: true,
  offlineMapPreload: false,
  highAccuracyGps: true,
  cameraQuality: "1080p",
  autoGeotag: true,
  shutterFeedback: true,
  wifiOnlySync: false,
  biometricLock: false,
  autoLockTimeout: "5min",
};

interface SettingsContextValue {
  settings: AppSettings;
  isPureDark: boolean;
  theme: ThemeColors;
  colors: ThemeColors;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const SETTINGS_STORAGE_KEY = "netram_app_settings_v1";

async function getStoredSettings(): Promise<string | null> {
  try {
    let result: string | null = null;
    try {
      result = await SecureStore.getItemAsync(SETTINGS_STORAGE_KEY);
    } catch {
      // Fall through to browser storage
    }
    if (!result && typeof window !== "undefined" && window.localStorage) {
      result = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    }
    return result;
  } catch {
    return null;
  }
}

async function persistSettings(json: string): Promise<void> {
  try {
    try {
      await SecureStore.setItemAsync(SETTINGS_STORAGE_KEY, json);
    } catch {
      // Fall through to browser storage
    }
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, json);
    }
  } catch {
    // ignore
  }
}

async function removeStoredSettings(): Promise<void> {
  try {
    try {
      await SecureStore.deleteItemAsync(SETTINGS_STORAGE_KEY);
    } catch {
      // Fall through to browser storage
    }
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    void (async () => {
      const stored = await getStoredSettings();
      if (stored) {
        try {
          setSettings({ ...defaultSettings, ...JSON.parse(stored) });
        } catch {
          // ignore
        }
      }
    })();
  }, []);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      void persistSettings(JSON.stringify(next));
      return next;
    });
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    void removeStoredSettings();
  };

  const isPureDark =
    settings.themeMode === "dark" ||
    (settings.themeMode === "system" && systemColorScheme === "dark");

  const theme: ThemeColors = isPureDark
    ? (pureDarkColors as unknown as ThemeColors)
    : defaultLightColors;

  return (
    <SettingsContext.Provider
      value={{
        settings,
        isPureDark,
        theme,
        colors: theme,
        updateSetting,
        resetSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    // Graceful fallback for tests or outside provider
    return {
      settings: defaultSettings,
      isPureDark: false,
      theme: defaultLightColors,
      colors: defaultLightColors,
      updateSetting: () => {},
      resetSettings: () => {},
    };
  }
  return ctx;
}

export function useTheme() {
  const ctx = useSettings();
  return {
    theme: ctx.theme,
    colors: ctx.theme,
    isPureDark: ctx.isPureDark,
    settings: ctx.settings,
    updateSetting: ctx.updateSetting,
  };
}
