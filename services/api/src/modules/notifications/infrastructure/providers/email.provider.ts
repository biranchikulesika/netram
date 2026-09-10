import type {
  NotificationDeliveryResult,
  NotificationProviderPort,
  OutboundNotification,
} from "../../application/ports/notification-provider-port.js";
import { SmtpClient, type SmtpClientOptions } from "./smtp-client.js";

/**
 * Email delivery through any SMTP server (MailHog/Inbucket in development,
 * a transactional provider's SMTP relay in production). The provider is
 * agnostic to the upstream vendor — credentials/config live in
 * `NETRAM_SMTP_URL`, isolated behind this adapter.
 */
export class EmailNotificationProvider implements NotificationProviderPort {
  readonly channel = "email" as const;
  private readonly client: SmtpClient;

  constructor(opts: SmtpClientOptions) {
    this.client = new SmtpClient(opts);
  }

  async send(notification: OutboundNotification): Promise<NotificationDeliveryResult> {
    const to = typeof notification.meta?.to === "string" ? notification.meta.to : null;
    if (!to) {
      return {
        channel: "email",
        provider: "smtp",
        delivered: false,
        reason: "no recipient address (meta.to)",
      };
    }
    const from =
      typeof notification.meta?.from === "string" ? notification.meta.from : this.client.sender;
    await this.client.send({
      to,
      from,
      subject: notification.title,
      text: notification.body ?? notification.title,
    });
    return { channel: "email", provider: "smtp", delivered: true };
  }
}