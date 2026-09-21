"use client";

import { useMemo } from "react";

/**
 * Static short field hint. Previously this cycled hint ↔ example on a timer;
 * the rotation was removed in favor of one concise, always-visible hint.
 * Returns the same `{ text, handlers }` shape so call sites keep working —
 * the handlers are now no-ops retained for API stability.
 */
export function useRotatingPlaceholder(phrases: readonly string[]) {
  return useMemo(
    () => ({
      text: phrases[0] ?? "",
      handlers: {
        onFocus: () => {},
        onBlur: () => {},
      },
    }),
    [phrases],
  );
}
