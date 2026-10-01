"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Reactive media-query hook (SSR-safe via useSyncExternalStore). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Distribute items into `count` columns round-robin: 1→c1, 2→c2, … preserving left-to-right reading order. */
export function distributeIntoColumns<T>(items: T[], count: number): T[][] {
  const cols: T[][] = Array.from({ length: Math.max(1, count) }, () => []);
  items.forEach((item, i) => {
    const col = cols[i % cols.length];
    if (col) col.push(item);
  });
  return cols;
}
