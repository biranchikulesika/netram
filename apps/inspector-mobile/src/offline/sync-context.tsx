import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import { OfflineInspectionQueue } from "./queue";
import type { NetramApiClient } from "@netram/api-client";

export interface SyncStatusContextValue {
  pendingCount: number;
  refreshPendingCount: () => Promise<number>;
  autoSync: (client: NetramApiClient | null) => Promise<void>;
}

const SyncStatusContext = createContext<SyncStatusContextValue | undefined>(undefined);

const queue = new OfflineInspectionQueue();

export function SyncStatusProvider({
  client,
  children,
}: {
  client: NetramApiClient | null;
  children: ReactNode;
}) {
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    try {
      const pending = await queue.getPendingOperations();
      setPendingCount(pending.length);
      return pending.length;
    } catch {
      return 0;
    }
  }, []);

  const autoSync = useCallback(
    async (apiClient: NetramApiClient | null) => {
      const activeClient = apiClient ?? client;
      if (!activeClient) return;

      try {
        const pending = await queue.getPendingOperations();
        if (pending.length === 0) {
          setPendingCount(0);
          return;
        }

        // Silent background sync (§5, P6-02)
        await queue.sync(activeClient);
        await refreshPendingCount();
      } catch {
        // Silent failure for auto-sync as required by P6-02
      }
    },
    [client, refreshPendingCount],
  );

  useEffect(() => {
    void refreshPendingCount();
  }, [refreshPendingCount]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        void autoSync(client);
      }
    });

    return () => subscription.remove();
  }, [autoSync, client]);

  return (
    <SyncStatusContext.Provider
      value={{
        pendingCount,
        refreshPendingCount,
        autoSync,
      }}
    >
      {children}
    </SyncStatusContext.Provider>
  );
}

export function useSyncStatus(): SyncStatusContextValue {
  const ctx = useContext(SyncStatusContext);
  if (!ctx) {
    return {
      pendingCount: 0,
      refreshPendingCount: async () => 0,
      autoSync: async () => {},
    };
  }
  return ctx;
}
