import type {
  NotificationDeliveryResult,
  NotificationProviderPort,
  OutboundNotification,
} from "../../application/ports/notification-provider-port.js";
import { DevLogNotificationProvider, UnconfiguredChannelProvider } from "./dev-transport.js";

/**
 * Push (FCM/APNs) delivery behind the provider interface (AGENTS.md §41).
 * A real vendor transport can be dropped in behind the same port; until one
 * is configured this adapter logs the outbound notification in development
 * and returns a traceable non-delivery in production.
 */
export class PushNotificationProvider implements NotificationProviderPort {
  readonly channel = "push" as const;
  private readonly transport: NotificationProviderPort;

  constructor(enabledInEnvironment: boolean) {
    this.transport = enabledInEnvironment
      ? new DevLogNotificationProvider("push", true)
      : new UnconfiguredChannelProvider("push");
  }

  async send(notification: OutboundNotification): Promise<NotificationDeliveryResult> {
    return this.transport.send(notification);
  }
}
