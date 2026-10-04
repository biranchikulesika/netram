import type { AttendanceDevice, DeviceHealthStatus } from "@netram/types";

/**
 * Attendance provider contract (§5). Device/vendor protocols stay behind
 * adapters; the core attendance domain never contains vendor logic.
 */
export interface ProviderDeviceEvent {
  /** Provider/device event identifier used for idempotent sync. */
  deviceEventId: string | null;
  externalUserId: string;
  rawType: string;
  occurredAt: Date;
  payload: Record<string, unknown> | null;
}

export interface AttendanceProviderHealth {
  status: DeviceHealthStatus;
  lastEventAt: Date | null;
  detail?: string;
}

export interface AttendanceProviderPort {
  readonly name: string;
  /**
   * Incrementally synchronizes buffered device events (§19). The cursor is
   * opaque to Netram (provider/device-defined).
   */
  sync(device: AttendanceDevice, cursor: string | null): Promise<ProviderDeviceEvent[]>;
  health(device: AttendanceDevice): AttendanceProviderHealth;
}
