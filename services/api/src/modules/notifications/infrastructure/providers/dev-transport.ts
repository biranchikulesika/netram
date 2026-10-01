import type {
  NotificationChannel,
  NotificationDeliveryResult,
  NotificationProviderPort,
  OutboundNotification,
} from "../../application/ports/notification-provider-port.js";

/**
 * Development transport for channels without a configured production vendor
 * (push/SMS today, and email when `NETRAM_SMTP_URL` is absent). Logging the
 * structured outbound notification IS the dev delivery (mirrors the
 * dev-auth-provider pattern - never enabled in production).
 */
export class DevLogNotificationProvider implements NotificationProviderPort {
  constructor(
    readonly channel: NotificationChannel,
    private readonly enabled: boolean,
  ) {}

  async send(notification: OutboundNotification): Promise<NotificationDeliveryResult> {
    if (!this.enabled) {
      return {
        channel: this.channel,
        provider: "dev-console",
        delivered: false,
        reason: `no ${this.channel} provider configured for this environment`,
      };
    }
    // Metadata only: notification titles/bodies can carry personal
    // information and must not be written to operational logs (§39).
    console.log(
      `[notification:${this.channel}] ${notification.notificationId} delivered via dev-console (no vendor configured)`,
    );
    return {
      channel: this.channel,
      provider: "dev-console",
      delivered: true,
      reason: "dev transport (no vendor configured)",
    };
  }
}

/**
 * Permanent-config-gap provider: returns a traceable non-delivery instead of
 * retrying forever on jobs that can never succeed.
 */
export class UnconfiguredChannelProvider implements NotificationProviderPort {
  constructor(readonly channel: NotificationChannel) {}
  async send(_notification: OutboundNotification): Promise<NotificationDeliveryResult> {
    return {
      channel: this.channel,
      provider: "unconfigured",
      delivered: false,
      reason: `no ${this.channel} provider is configured for this environment`,
    };
  }
}
