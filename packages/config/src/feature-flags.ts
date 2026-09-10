export type FeatureFlagEnvironment = "development" | "test" | "ci" | "demo" | "production";

export interface FeatureFlagDefinition {
  key: string;
  /** Default value when no database-provided flag exists. */
  default: boolean;
  /** Environments in which the flag is permitted to be overridden. */
  allowedEnvironments: FeatureFlagEnvironment[];
  description?: string;
}

export const FEATURE_FLAGS: Record<string, boolean> = {
  "ai.anomaly_detection": false,
  "cctv.live_streaming": false,
  "notifications.sms": false,
  "inspections.random_assignment": true,
  "realtime.delivery": true,
  "evidence.offline_capture": true,
};

export class FeatureFlags {
  constructor(
    private readonly environment: FeatureFlagEnvironment,
    private readonly overrides: Record<string, boolean> = {},
  ) {}

  isEnabled(key: string): boolean {
    if (this.overrides[key] !== undefined) return this.overrides[key]!;
    return FEATURE_FLAGS[key] ?? false;
  }
}

export const featureFlags = new FeatureFlags(
  (process.env.NODE_ENV as FeatureFlagEnvironment | undefined) ?? "development",
);
