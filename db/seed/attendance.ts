import { AttendanceRepository, type DrizzleDB } from "@netram/data";
import { did } from "./ids";

/**
 * Attendance event ledger: the per-person biometric punches that the rest of the
 * attendance subsystem is derived from.
 *
 * ## Why this module exists
 *
 * The seed already wrote devices, populations, rosters, identity mappings,
 * source observations, daily calculations, anomaly groups, anomalies, review
 * actions and corrections - but `attendance_events` and
 * `attendance_raw_transactions` were left empty. That is not a cosmetic gap:
 * `attendance_calculations` is a *derived* table, so a calculation row saying
 * "151 present, 149 of them biometric" had nothing behind it. Every
 * person-level drill-down and every individual-attendance export read from
 * `attendance_events`, so those screens were structurally empty while the
 * aggregate screens looked populated.
 *
 * ## The one rule that matters: events must agree with the stored calculations
 *
 * The naive approach - generate events from a fresh random-ish model - would
 * have *created* a contradiction rather than removed one, because the
 * calculation rows are the authority the rest of the demo already quotes (the
 * anomaly `supportingSignals`, the year-calendar track record, the risk
 * scorer's attendance dimension). So instead of inventing attendance and
 * hoping it lines up, this module **reads the stored `sourceCounts.BIOMETRIC`
 * for each calculation and emits exactly that many events for that date**.
 *
 * Agreement is therefore structural, not coincidental: whatever a calculation
 * says was biometric-present is what a person-level count of the events will
 * return. That property is what makes the change safe to make without touching
 * a single existing row, and it holds for the awkward cases too - the
 * `2026-03-01` placeholders that record `present: 0` correctly get zero events
 * (a silent device is what makes attendance look absent), while the 365-day
 * Vani series gets a full ledger.
 *
 * ## Determinism (AGENTS.md §13, and the contract in ./project-operations.ts)
 *
 * No `Math.random`, no `Date.now`, no reliance on Map or Set insertion order.
 * Every id is `did("...")`; every timestamp is derived from a literal
 * operational date plus an integer offset. Re-running the seed on a reset
 * database reproduces byte-identical ids, which is what lets the demo database
 * be dropped and re-seeded every 30 minutes without invalidating the offline
 * operation ids the mobile app is holding.
 *
 * *Which* people are absent on a given day is chosen by a rotation of the
 * roster keyed on the day-of-year, so the absent set genuinely moves day to day
 * (otherwise every person would simply be absent on the same tail of the
 * roster, which looks obviously synthetic on the individual drill-down) while
 * remaining exactly reproducible.
 *
 * ## Scope
 *
 * A full year of per-person punches for every project is ~150k events, which
 * buys nothing a reviewer can see and makes the seed slow. So the ledger covers
 * the most recent `RECENT_DAYS` calculated days per project, plus every
 * operational date that carries an attendance anomaly - the anomaly dates are
 * the ones a demo actually navigates to, and they include the March 2026
 * cross-source discrepancy that the inspection findings quote.
 */

/** Calculated days per project to expand into per-person events. */
const RECENT_DAYS = 45;

/** Batched insert size. Keeps each statement well inside Postgres limits. */
const CHUNK = 1000;

/**
 * Roll-call windows, in minutes from midnight. Read from the seeded
 * `attendance_windows` rather than hardcoded per project, so a window whose
 * times change in `index.ts` does not silently push punches outside it.
 */
type WindowShape = { startTime: string; endTime: string };

export function windowMinutes(iso: string, time: string): number {
  const [h, m] = time.split(":").map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) {
    throw new Error(`seed: invalid window time literal ${JSON.stringify(time)} on ${iso}`);
  }
  return h * 60 + m;
}

/** Day-of-year for a literal `YYYY-MM-DD`, without pulling in a date library. */
export function dayOfYear(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) {
    throw new Error(`seed: invalid operational date ${JSON.stringify(iso)}`);
  }
  const start = Date.UTC(y, 0, 1);
  const current = Date.UTC(y, m - 1, d);
  return Math.floor((current - start) / 86_400_000) + 1;
}

/**
 * Deterministically choose which `present` of `roster.length` people attended.
 *
 * A wrap-around block starting at a day-of-year offset: reproducible, spreads
 * the absent set evenly around the roster instead of always trimming the tail,
 * and - importantly - never returns the same people on consecutive days.
 */
export function attendeesFor(roster: string[], present: number, iso: string): string[] {
  const size = roster.length;
  if (size === 0 || present <= 0) return [];
  const take = Math.min(present, size);
  const offset = dayOfYear(iso) % size;
  const out: string[] = [];
  for (let i = 0; i < take; i++) {
    out.push(roster[(offset + i) % size]!);
  }
  return out;
}

/** The device a project's roll call is actually recorded on. */
type DeviceChoice = { deviceId: string; deviceExternalId: string; roster: string[] };

export async function seedAttendanceLedger(db: DrizzleDB): Promise<void> {
  const repo = new AttendanceRepository(db);

  // ---------------------------------------------------------------- sources ----
  // Everything below is read back out of the database rather than restated, so
  // this module cannot drift from the reference data in ./index.ts.
  const calculations = await repo.listAllCalculations({});
  if (calculations.length === 0) return;

  const windows = new Map<string, WindowShape & { populationId: string | null }>();
  for (const project of new Set(calculations.map((c) => c.projectId))) {
    for (const w of await repo.listWindows(project)) {
      windows.set(w.id, {
        startTime: w.startTime,
        endTime: w.endTime,
        populationId: w.populationId,
      });
    }
  }

  // Anomaly dates are always expanded, whatever their age.
  const anomalyDates = new Map<string, Set<string>>();
  for (const project of new Set(calculations.map((c) => c.projectId))) {
    const { items } = await repo.listAnomalies({ projectId: project, page: 1, pageSize: 500 });
    for (const a of items) {
      if (!a.operationalDate) continue;
      const set = anomalyDates.get(a.projectId) ?? new Set<string>();
      set.add(a.operationalDate);
      anomalyDates.set(a.projectId, set);
    }
  }

  // Per project: pick the device that carries the roster, and take its members
  // in a stable order. Devices seeded purely to demonstrate a sync failure
  // (low_attendance, duplicates, unmatched scenarios) map few or no people and
  // are not the device a real roll call is recorded on.
  const devices = new Map<string, DeviceChoice>();
  for (const project of new Set(calculations.map((c) => c.projectId))) {
    const { items: mappings } = await repo.listIdentityMappings({
      projectId: project,
      page: 1,
      pageSize: 5000,
    });
    const projectDevices = await repo.listDevices({ projectId: project });

    // Devices seeded purely to demonstrate a sync failure ("Low Attendance
    // Device (demo)", "Duplicate Demo Device") carry the same roster as the real
    // gate device, so mapping count alone cannot separate them. They are
    // excluded by name: `config.scenario` is deliberately absent from the
    // domain `AttendanceDevice` type (it holds simulator detail), and `name` is
    // the domain-visible attribute the seed itself sets.
    const candidates = projectDevices
      .map((device) => {
        const roster = mappings
          .filter((m) => m.deviceId === device.id)
          .map((m) => m.personExternalId)
          .sort();
        const name = device.name.toLowerCase();
        const demo = name.includes("demo") || name.includes("low attendance");
        return {
          deviceId: device.id,
          deviceExternalId: device.deviceExternalId,
          roster,
          demo,
        };
      })
      .filter((c) => c.roster.length > 0 && !c.demo);

    const best = candidates.sort(
      (a, b) =>
        b.roster.length - a.roster.length || a.deviceExternalId.localeCompare(b.deviceExternalId),
    )[0];
    if (best) {
      devices.set(project, {
        deviceId: best.deviceId,
        deviceExternalId: best.deviceExternalId,
        roster: best.roster,
      });
    }
  }

  // ----------------------------------------------------------- which days ----
  // Recency window per project, unioned with that project's anomaly dates.
  const byProject = new Map<string, typeof calculations>();
  for (const calc of calculations) {
    const list = byProject.get(calc.projectId) ?? [];
    list.push(calc);
    byProject.set(calc.projectId, list);
  }

  const rawRows: Parameters<AttendanceRepository["insertRawTransactions"]>[0] = [];
  const eventRows: Parameters<AttendanceRepository["insertEvents"]>[0] = [];

  for (const [projectId, all] of [...byProject].sort(([a], [b]) => a.localeCompare(b))) {
    const device = devices.get(projectId);
    if (!device) continue;

    // listAllCalculations is ordered newest-first.
    const recentDates = new Set(all.slice(0, RECENT_DAYS).map((c) => c.operationalDate));
    const wanted = new Map<string, (typeof all)[number]>();
    for (const calc of all) {
      if (
        recentDates.has(calc.operationalDate) ||
        anomalyDates.get(projectId)?.has(calc.operationalDate)
      ) {
        wanted.set(calc.operationalDate, calc);
      }
    }

    for (const [iso, calc] of [...wanted].sort(([a], [b]) => a.localeCompare(b))) {
      const expectedBiometric = Number(
        (calc.sourceCounts as Record<string, number> | null)?.BIOMETRIC ?? 0,
      );
      if (expectedBiometric <= 0) continue; // a silent device: no punches, no events

      const window = windows.get(calc.windowId);
      if (!window) continue;
      const from = windowMinutes(iso, window.startTime);
      const to = windowMinutes(iso, window.endTime);
      const span = Math.max(1, to - from);
      const day = dayOfYear(iso);

      for (const [index, personExternalId] of attendeesFor(
        device.roster,
        expectedBiometric,
        iso,
      ).entries()) {
        const rawId = did(`attraw:${device.deviceExternalId}:${personExternalId}:${iso}`);
        const offsetMinutes = (day * 3 + index * 7) % span;
        const occurredAt = new Date(
          Date.UTC(
            Number(iso.slice(0, 4)),
            Number(iso.slice(5, 7)) - 1,
            Number(iso.slice(8, 10)),
            0,
            from + offsetMinutes,
            (index * 13) % 60,
          ),
        );

        rawRows.push({
          id: rawId,
          deviceId: device.deviceId,
          externalUserId: personExternalId,
          deviceEventId: `${device.deviceExternalId}-${iso}-${personExternalId}-IN`,
          occurredAt,
          rawType: "PUNCH",
          payload: { direction: "IN", method: "FINGERPRINT", seq: index + 1 },
          syncCursor: iso,
        });

        eventRows.push({
          id: did(`attevent:${device.deviceExternalId}:${personExternalId}:${iso}`),
          projectId,
          deviceId: device.deviceId,
          populationId: window.populationId,
          personExternalId,
          netramUserId: null,
          eventType: "CHECK_IN",
          occurredAt,
          rawTransactionId: rawId,
          windowId: calc.windowId,
          operationalDate: iso,
          dedupKey: `${device.deviceExternalId}:${personExternalId}:${iso}:CHECK_IN`,
        });
      }
    }
  }

  // Raw transactions first: events carry a foreign key onto them.
  for (let i = 0; i < rawRows.length; i += CHUNK) {
    await repo.insertRawTransactions(rawRows.slice(i, i + CHUNK));
  }
  for (let i = 0; i < eventRows.length; i += CHUNK) {
    await repo.insertEvents(eventRows.slice(i, i + CHUNK));
  }

  // -------------------------------------------------------------- exports ----
  // A few export requests per project so the export history is not an empty
  // table: two ready-and-downloaded, one that failed, one that expired because
  // nothing downloaded it inside the 24h retention window from the seeded
  // config.
  //
  // Keyed by seed name for readability, then resolved to the same UUIDs the
  // rest of this module works in. The requester mirrors each project's own
  // officer/inspector from ./project-operations.ts.
  const requestersById = new Map<string, string>(
    Object.entries({
      "project:vani": "user:officer-khordha",
      "project:cuttack-girls": "user:officer-cuttack",
      "project:ganjam-school": "user:inspector-3",
      "project:rourkela": "user:inspector-4",
      "project:rajdhani": "user:officer-khordha",
      "project:purisch-1": "user:programme-officer",
      "project:puri-irca": "user:programme-officer",
    }).map(([project, user]) => [did(project), user]),
  );

  for (const [projectId, all] of [...byProject].sort(([a], [b]) => a.localeCompare(b))) {
    const requester = requestersById.get(projectId);
    if (!requester || all.length === 0) continue;

    // `all` is newest-first. Every record count is summed from the project's own
    // calculations rather than invented, so a 30-bed centre does not end up
    // claiming the same 51k-row export as a 160-bed hostel. The request
    // timestamps are likewise derived from the project's own latest calculated
    // day, because a request cannot sensibly predate the range it asks for and
    // the projects do not all end on the same date.
    const totalPresent = all.reduce((sum, c) => sum + c.present, 0);
    const oldest = all[all.length - 1]!.operationalDate;
    const newest = all[0]!.operationalDate;
    const recent30 = all.slice(0, 30);
    const monthFrom = recent30[recent30.length - 1]!.operationalDate;

    // `newest` at `hh:mm`, shifted `days` forward, as a literal ISO timestamp.
    const askedOn = (days: number, hhmm: string): Date => {
      const d = new Date(`${newest}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + days);
      return new Date(`${d.toISOString().slice(0, 10)}T${hhmm}:00Z`);
    };

    const plans: {
      suffix: string;
      from: string;
      to: string;
      requestedAt: Date;
      recordCount: number;
      outcome: "downloaded" | "failed" | "expired";
    }[] = [
      {
        suffix: "recent",
        from: newest,
        to: newest,
        requestedAt: askedOn(0, "10:05"),
        recordCount: all[0]!.present,
        outcome: "downloaded",
      },
      {
        suffix: "month",
        from: monthFrom,
        to: newest,
        requestedAt: askedOn(1, "08:40"),
        recordCount: recent30.reduce((sum, c) => sum + c.present, 0),
        outcome: "downloaded",
      },
      {
        // The realistic failure: a full-year request against a row cap.
        suffix: "year",
        from: "2026-01-01",
        to: "2026-12-31",
        requestedAt: askedOn(1, "09:15"),
        recordCount: 0,
        outcome: "failed",
      },
      {
        // The whole seeded history, left to expire undownloaded.
        suffix: "archive",
        from: oldest,
        to: newest,
        requestedAt: askedOn(2, "11:20"),
        recordCount: totalPresent,
        outcome: "expired",
      },
    ];

    for (const plan of plans) {
      const id = did(`attexport:${projectId}:${plan.suffix}`);
      const requestedAt = plan.requestedAt;
      await repo.insertExport({
        id,
        projectId,
        requestedBy: did(requester),
        scope: { from: plan.from, to: plan.to, granularity: "daily" },
        format: "csv",
        requestedAt,
      });

      // A full-year request is the realistic failure: the export worker caps
      // row count, so it is left FAILED with the reason rather than silently
      // producing a truncated file. The archive row shows the 24h retention
      // policy from the seeded config expiring an undownloaded artifact.
      if (plan.outcome === "failed") {
        await repo.updateExport(id, {
          status: "FAILED",
          error:
            "Requested range covers 365 days and exceeds the 100000 row export limit; narrow the range and retry.",
          generatedAt: new Date(requestedAt.getTime() + 12_000),
        });
        continue;
      }

      await repo.updateExport(id, {
        status: plan.outcome === "expired" ? "EXPIRED" : "READY",
        artifactKey: `exports/attendance/${projectId}/${plan.suffix}.csv`,
        recordCount: plan.recordCount,
        generatedAt: new Date(requestedAt.getTime() + 45_000),
        expiresAt: new Date(requestedAt.getTime() + 86_400_000),
      });

      if (plan.outcome === "downloaded") {
        await repo.updateExport(id, { downloadedAt: new Date(requestedAt.getTime() + 180_000) });
      }
    }
  }

  console.log(
    `Attendance ledger: ${rawRows.length} raw transactions, ${eventRows.length} events across ${byProject.size} projects.`,
  );
}
