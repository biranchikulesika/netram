import type { NotificationType } from "@netram/types";

/**
 * Provider-agnostic notification contract (AGENTS.md §41).
 *
 * Business logic emits application/domain events and never calls vendors
 * directly. Delivery happens through a `NotificationProviderPort` adapter:
 * the in-app adapter persists to the notifications table, the email adapter
 * speaks SMTP, and push/SMS remain pluggable behind the same interface.
 */

export const NOTIFICATION_CHANNELS = ["in_app", "push", "email", "sms"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export interface OutboundNotification {
  /** Idempotency/correlation key - safe to retry with the same id. */
  notificationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  channel: NotificationChannel;
  /** Channel-specific recipient context (email address, phone, push token). */
  meta?: Record<string, unknown>;
}

export interface NotificationDeliveryResult {
  channel: NotificationChannel;
  /** Adapter identity, e.g. "in-app", "smtp", "dev-console". */
  provider: string;
  delivered: boolean;
  /** Why delivery did not happen (missing config, placeholder recipient...). */
  reason?: string;
}

export interface NotificationProviderPort {
  readonly channel: NotificationChannel;
  send(notification: OutboundNotification): Promise<NotificationDeliveryResult>;
}
