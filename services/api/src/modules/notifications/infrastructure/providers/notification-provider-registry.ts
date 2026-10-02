import type { NotificationRepository } from "@netram/data";
import type {
  NotificationChannel,
  NotificationDeliveryResult,
  NotificationProviderPort,
  OutboundNotification,
} from "../../application/ports/notification-provider-port.js";
import { DevLogNotificationProvider, UnconfiguredChannelProvider } from "./dev-transport.js";
import { EmailNotificationProvider } from "./email.provider.js";
import { InAppNotificationProvider } from "./in-app.provider.js";
import { PushNotificationProvider } from "./push.provider.js";
import { SmsNotificationProvider } from "./sms.provider.js";
import { parseSmtpUrl } from "./smtp-client.js";

export interface NotificationProviderDeps {
  notificationRepo: Pick<NotificationRepository, "create">;
  /** smtp:// or smtps:// URL. When absent, email falls back to dev transport. */
  smtpUrl?: string;
  /** "production" disables dev transports for push/SMS/email fallback. */
  nodeEnv?: string;
  /** Envelope sender used when `meta.from` is not provided. */
  emailFrom?: string;
}

export const DEFAULT_EMAIL_FROM = "noreply@netram.in";

/**
 * Selects the concrete adapter per channel based on environment configuration.
 * Provider integration stays isolated behind `NotificationProviderPort`
 * (§41): swapping a vendor never touches business logic.
 */
export class NotificationProviderRegistry {
  private readonly providers = new Map<NotificationChannel, NotificationProviderPort>();

  constructor(deps: NotificationProviderDeps) {
    const devTransportsEnabled = (deps.nodeEnv ?? "development") !== "production";

    this.providers.set("in_app", new InAppNotificationProvider(deps.notificationRepo));
    this.providers.set(
      "email",
      deps.smtpUrl
        ? new EmailNotificationProvider(
            parseSmtpUrl(deps.smtpUrl, deps.emailFrom ?? DEFAULT_EMAIL_FROM),
          )
        : devTransportsEnabled
          ? new DevLogNotificationProvider("email", true)
          : new UnconfiguredChannelProvider("email"),
    );
    this.providers.set("push", new PushNotificationProvider(devTransportsEnabled));
    this.providers.set("sms", new SmsNotificationProvider(devTransportsEnabled));
  }

  get(channel: NotificationChannel): NotificationProviderPort {
    const provider = this.providers.get(channel);
    if (!provider) throw new Error(`No notification provider for channel "${channel}"`);
    return provider;
  }

  async send(notification: OutboundNotification): Promise<NotificationDeliveryResult> {
    return this.get(notification.channel).send(notification);
  }
}
