import type { NotificationRepository } from "@netram/data";
import type {
  NotificationDeliveryResult,
  NotificationProviderPort,
  OutboundNotification,
} from "../../application/ports/notification-provider-port.js";

/**
 * Placeholder recipient used by background jobs before real recipient
 * resolution (e.g. actor-less scheduled events). Advisory-only: the intended
 * notification is logged by the worker, but no in-app row is persisted for a
 * user that does not exist (would violate the notifications.user_id FK).
 */
export const PLACEHOLDER_USER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * In-app notifications persist a row in the notifications table; the app's
 * notification inbox then surfaces it as unread ("pending").
 */
export class InAppNotificationProvider implements NotificationProviderPort {
  readonly channel = "in_app" as const;

  constructor(private readonly repo: Pick<NotificationRepository, "create">) {}

  async send(notification: OutboundNotification): Promise<NotificationDeliveryResult> {
    if (notification.userId === PLACEHOLDER_USER_ID) {
      return {
        channel: "in_app",
        provider: "in-app",
        delivered: false,
        reason: "placeholder recipient; advisory only",
      };
    }
    await this.repo.create({
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      body: notification.body ?? null,
    });
    return { channel: "in_app", provider: "in-app", delivered: true };
  }
}