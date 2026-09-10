import type { NotificationStatus } from "@netram/types";

export const NOTIFICATION_TRANSITIONS: Record<NotificationStatus, readonly NotificationStatus[]> = {
  pending: ["read"],
  read: [],
} as const;

export class InvalidNotificationTransitionError extends Error {
  constructor(from: NotificationStatus, to: NotificationStatus) {
    super(`Invalid notification transition: ${from} -> ${to}`);
    this.name = "InvalidNotificationTransitionError";
  }
}

/**
 * Notification lifecycle is simple: pending → read.
 * Notifications are event-driven, append-only, and created by the system,
 * not by user action (§41).
 */
export function evaluateNotificationTransition(
  from: NotificationStatus,
  to: NotificationStatus,
): { to: NotificationStatus } {
  if (!NOTIFICATION_TRANSITIONS[from].includes(to)) {
    throw new InvalidNotificationTransitionError(from, to);
  }
  return { to };
}
