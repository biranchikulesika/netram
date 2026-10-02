"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Every dashboard section keeps its filters and view in the URL, so a refresh
 * restores exactly what the user was looking at and a link can be shared.
 * Null or empty values are dropped, which keeps shared URLs short.
 */
export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );
}
