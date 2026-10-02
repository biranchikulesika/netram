import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, type NetramApiClient } from "@netram/api-client";
import { OfflineInspectionQueue, type CachedInspectionRecord } from "./queue";

/**
 * The API already scopes `GET /api/v1/inspections` to the caller's jurisdiction
 * and disclosure policy, and returns `assignedUserIds` for every row. An
 * inspector can still be disclosed inspections they are not the assignee of, so
 * the device narrows the list to their own assignments before it is shown or
 * cached for offline use.
 *
 * `assigned_user_ids` is a JSON array of user UUIDs; a row that fails to parse is
 * dropped rather than guessed at.
 */
export function filterAssignedInspections(
  records: CachedInspectionRecord[],
  userId: string | undefined,
): CachedInspectionRecord[] {
  if (!userId) return records;
  return records.filter((record) => {
    try {
      const ids = JSON.parse(record.assigned_user_ids || "[]") as string[];
      return ids.includes(userId);
    } catch {
      return false;
    }
  });
}

/**
 * Why a refresh did not produce fresh data. Callers must be able to tell these
 * apart: "the device is offline" and "your session expired" look identical if
 * both collapse into `false`, and an expired session then renders as an empty
 * assignment list instead of a prompt to sign in again.
 */
export type RefreshOutcome = "refreshed" | "unauthorized" | "unavailable";

/**
 * Reconciles the local cache against the authoritative API (§8, §31).
 *
 * Offline-first: a failed request leaves the cached rows untouched, so the app
 * still opens with the last known assignments. The server stays authoritative;
 * this only decides when to read its answer.
 */
export async function refreshInspectionsFromServer(
  client: NetramApiClient,
  queue: OfflineInspectionQueue,
  pageSize = 50,
): Promise<RefreshOutcome> {
  try {
    const page = await client.listInspections({ pageSize });
    if (page.items.length > 0) {
      await queue.cacheInspections(page.items);
    }
    return "refreshed";
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      return "unauthorized";
    }
    return "unavailable";
  }
}

export interface AssignedInspectionsFeed {
  /** Cached inspections assigned to the signed-in inspector, newest first. */
  inspections: CachedInspectionRecord[];
  refreshing: boolean;
  /** Last refresh attempt that did not succeed, if any. */
  problem: RefreshOutcome | null;
  /** Re-reads the cache, reconciling with the server first when online. */
  refresh: () => Promise<void>;
}

/**
 * Single source of the inspector's assignment list for the dashboard, history
 * and map, so none of those screens can drift into reading the cache without
 * ever talking to the API.
 */
export function useAssignedInspections(
  client: NetramApiClient | null,
  userId: string | undefined,
): AssignedInspectionsFeed {
  const queue = useMemo(() => new OfflineInspectionQueue(), []);
  const [inspections, setInspections] = useState<CachedInspectionRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [problem, setProblem] = useState<RefreshOutcome | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // No client means no valid session; the auth context has already cleared
      // it and routed the user to login, so there is nothing to reconcile.
      const outcome = client ? await refreshInspectionsFromServer(client, queue) : null;
      setProblem(outcome && outcome !== "refreshed" ? outcome : null);
      try {
        setInspections(filterAssignedInspections(await queue.getCachedInspections(), userId));
      } catch {
        // Unreadable cache: keep whatever is already on screen.
      }
    } finally {
      setRefreshing(false);
    }
  }, [client, queue, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { inspections, refreshing, problem, refresh };
}