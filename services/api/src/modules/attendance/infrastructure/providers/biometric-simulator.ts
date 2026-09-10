import type { AttendanceDevice } from "@netram/types";
import type {
  AttendanceProviderHealth,
  AttendanceProviderPort,
  ProviderDeviceEvent,
} from "../../application/ports/attendance-provider-port.js";

/**
 * Deterministic biometric simulator (§5, §59). No physical hardware required:
 * local development, tests, and demos all drive the real ingestion pipeline.
 * Scenarios are selected per device via `device.config.scenario`:
 *
 *   normal | discrepancy | low_attendance | duplicates | unmatched |
 *   offline_buffered | multi_device
 *
 * Events are generated from a seeded PRNG so runs are reproducible.
 */

export type SimulatorScenario =
  | "normal"
  | "discrepancy"
  | "low_attendance"
  | "duplicates"
  | "unmatched"
  | "offline_buffered"
  | "multi_device";

const DEFAULT_WINDOW = { start: 6, end: 9 }; // Morning window, local UTC hours

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function personId(n: number): string {
  return `person-${String(n).padStart(3, "0")}`;
}

export interface SimulatorSyncOptions {
  /** Operational date (YYYY-MM-DD) to generate events for. */
  operationalDate: string;
  /** Force buffered/late arrival (occurredAt in the past, received now). */
  lateHours?: number;
  /** Override the device's scenario. */
  scenario?: SimulatorScenario;
}

/** Simulator-specific device config stored in attendance_devices.config (§59). */
export interface SimulatorDeviceConfig {
  scenario?: SimulatorScenario;
}

function baseEventsFor(
  device: AttendanceDevice,
  opts: SimulatorSyncOptions,
  presentCount: number,
  withCheckIn: boolean,
): ProviderDeviceEvent[] {
  const rand = mulberry32(hashString(`${device.id}:${opts.operationalDate}`));
  const dayStart = new Date(`${opts.operationalDate}T00:00:00.000Z`);
  const windowStart = DEFAULT_WINDOW.start * 60;
  const windowEnd = DEFAULT_WINDOW.end * 60;
  const events: ProviderDeviceEvent[] = [];

  for (let n = 1; n <= presentCount; n++) {
    const minute = windowStart + Math.floor(rand() * (windowEnd - windowStart));
    const occurredAt = new Date(dayStart.getTime() + minute * 60_000);
    events.push({
      deviceEventId: `${device.deviceExternalId}-${opts.operationalDate}-${n}`,
      externalUserId: personId(n),
      rawType: withCheckIn && rand() < 0.6 ? "CHECK_IN" : "FINGERPRINT_VERIFIED",
      occurredAt: opts.lateHours
        ? new Date(occurredAt.getTime() - opts.lateHours * 3_600_000)
        : occurredAt,
      payload: { sim: true, seq: n },
    });
  }
  return events;
}

export class BiometricSimulatorProvider implements AttendanceProviderPort {
  readonly name = "biometric-simulator";

  constructor(private readonly now: () => Date = () => new Date()) {}

  async sync(
    device: AttendanceDevice,
    cursor: string | null,
  ): Promise<ProviderDeviceEvent[]> {
    const scenario = (this.deviceDeviceConfig(device)?.scenario ?? "normal") as SimulatorScenario;
    return this.generate(device, { scenario, operationalDate: cursor ?? this.today() });
  }

  health(device: AttendanceDevice): AttendanceProviderHealth {
    const scenario = (this.deviceDeviceConfig(device)?.scenario ?? "normal") as SimulatorScenario;
    if (scenario === "offline_buffered") {
      return { status: "OFFLINE", lastEventAt: null, detail: "simulated offline, buffering events" };
    }
    return { status: "ONLINE", lastEventAt: device.lastEventAt ? new Date(device.lastEventAt) : null };
  }

  /** Deterministic event generation per scenario — used directly by tests too. */
  generate(device: AttendanceDevice, opts: SimulatorSyncOptions): ProviderDeviceEvent[] {
    const scenario = opts.scenario ?? ((this.deviceDeviceConfig(device)?.scenario ?? "normal") as SimulatorScenario);
    const events: ProviderDeviceEvent[] = [];

    switch (scenario) {
      case "normal":
        events.push(...baseEventsFor(device, opts, 160, true));
        break;
      case "discrepancy":
        // Biometric observes 142 of 180 — the institution reports 168 via the
        // INSTITUTION_REPORTED observation endpoint, producing a discrepancy.
        events.push(...baseEventsFor(device, opts, 142, true));
        break;
      case "low_attendance":
        events.push(...baseEventsFor(device, opts, 64, true));
        break;
      case "duplicates": {
        const base = baseEventsFor(device, opts, 150, true);
        events.push(...base);
        // Extra transactions for the same persons (08:01/08:02/08:05 pattern).
        for (const b of base.slice(0, 12)) {
          const dup = new Date(b.occurredAt.getTime() + 60_000);
          events.push({
            deviceEventId: `${b.deviceEventId}-dup1`,
            externalUserId: b.externalUserId,
            rawType: "FINGERPRINT_VERIFIED",
            occurredAt: dup,
            payload: { sim: true, duplicate: true },
          });
          events.push({
            deviceEventId: `${b.deviceEventId}-dup2`,
            externalUserId: b.externalUserId,
            rawType: "FINGERPRINT_VERIFIED",
            occurredAt: new Date(dup.getTime() + 60_000),
            payload: { sim: true, duplicate: true },
          });
        }
        break;
      }
      case "unmatched": {
        events.push(...baseEventsFor(device, opts, 150, true));
        // Two unknown identities — preserved as unmatched, never fabricated.
        const dayStart = new Date(`${opts.operationalDate}T00:00:00.000Z`);
        events.push({
          deviceEventId: `${device.deviceExternalId}-unmatched-1`,
          externalUserId: "UNKNOWN-CARD-7741",
          rawType: "FINGERPRINT_VERIFIED",
          occurredAt: new Date(dayStart.getTime() + 6.5 * 3_600_000),
          payload: { sim: true, unmatched: true },
        });
        events.push({
          deviceEventId: `${device.deviceExternalId}-unmatched-2`,
          externalUserId: "UNKNOWN-CARD-9912",
          rawType: "FINGERPRINT_VERIFIED",
          occurredAt: new Date(dayStart.getTime() + 7 * 3_600_000),
          payload: { sim: true, unmatched: true },
        });
        break;
      }
      case "offline_buffered":
        // Device was offline for 2 days; events arrive now (late-arriving, §20).
        events.push(...baseEventsFor(device, { ...opts, lateHours: 48 }, 130, true));
        break;
      case "multi_device":
        // Same persons observed on this device; dedup across devices happens
        // in attendance calculation (§18).
        events.push(...baseEventsFor(device, opts, 90, true));
        break;
      default:
        events.push(...baseEventsFor(device, opts, 160, true));
    }

    return events;
  }

  private deviceDeviceConfig(device: AttendanceDevice): SimulatorDeviceConfig | undefined {
    try {
      const raw = (typeof (device as unknown as { config?: unknown }).config === "object"
        && (device as unknown as { config?: unknown }).config !== null
        ? (device as unknown as { config: unknown }).config
        : null);
      return raw ? (JSON.parse(JSON.stringify(raw)) as SimulatorDeviceConfig) : undefined;
    } catch {
      return undefined;
    }
  }

  private today(): string {
    const now = this.now();
    return now.toISOString().slice(0, 10);
  }
}