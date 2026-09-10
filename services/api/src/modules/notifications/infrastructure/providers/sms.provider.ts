import type {
  NotificationDeliveryResult,
  NotificationProviderPort,
  OutboundNotification,
} from "../../application/ports/notification-provider-port.js";
import { DevLogNotificationProvider, UnconfiguredChannelProvider } from "./dev-transport.js";

/**
 * SMS delivery behind the provider interface (AGENTS.md §41). A real vendor
 * transport (e.g. Twilio) can be dropped in behind the same port; until one
 * is configured this adapter logs the outbound notification in development
 * and returns a traceable non-delivery in production.
 */
export class SmsNotificationProvider implements NotificationProviderPort {
  readonly channel = "sms" as const;
  private readonly transport: NotificationProviderPort;

  constructor(enabledInEnvironment: boolean) {
    this.transport = enabledInEnvironment
      ? new DevLogNotificationProvider("sms", true)
      : new UnconfiguredChannelProvider("sms");
  }

  async send(notification: OutboundNotification): Promise<NotificationDeliveryResult> {
    return this.transport.send(notification);
  }
}