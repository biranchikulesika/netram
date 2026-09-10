import { afterEach, describe, expect, it, vi } from "vitest";
import type { NotificationRepository } from "@netram/data";
import type { OutboundNotification } from "../../application/ports/notification-provider-port.js";
import { InAppNotificationProvider, PLACEHOLDER_USER_ID } from "./in-app.provider.js";
import { NotificationProviderRegistry } from "./notification-provider-registry.js";

type RepoStub = Pick<NotificationRepository, "create">;

function stubRepo() {
  return { create: vi.fn().mockResolvedValue({}) } as unknown as RepoStub;
}

function outbound(overrides: Partial<OutboundNotification> = {}): OutboundNotification {
  return {
    notificationId: "notif-test-1",
    userId: "user-1",
    type: "inspection.assigned",
    title: "Test Notification",
    body: null,
    channel: "in_app",
    ...overrides,
  };
}

const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
afterEach(() => {
  consoleSpy.mockClear();
});

describe("NotificationProviderRegistry", () => {
  it("routes in_app notifications through the in-app adapter and persists", async () => {
    const repo = stubRepo();
    const registry = new NotificationProviderRegistry({ notificationRepo: repo });
    const result = await registry.send(outbound());

    expect(result.delivered).toBe(true);
    expect(result.provider).toBe("in-app");
    expect(repo.create).toHaveBeenCalledWith({
      userId: "user-1",
      type: "inspection.assigned",
      title: "Test Notification",
      body: null,
    });
  });

  it("logs push/SMS/email via the dev transport in development when unconfigured", async () => {
    const repo = stubRepo();
    const registry = new NotificationProviderRegistry({ notificationRepo: repo });

    for (const channel of ["push", "sms", "email"] as const) {
      const result = await registry.send(outbound({ channel }));
      expect(result.delivered).toBe(true);
      expect(result.provider).toBe("dev-console");
    }
    expect(consoleSpy).toHaveBeenCalledTimes(3);
  });

  it("returns traceable non-deliveries for unconfigured channels in production", async () => {
    const repo = stubRepo();
    const registry = new NotificationProviderRegistry({
      notificationRepo: repo,
      nodeEnv: "production",
    });

    for (const channel of ["push", "sms", "email"] as const) {
      const result = await registry.send(outbound({ channel }));
      expect(result.delivered).toBe(false);
      expect(result.reason).toBe(`no ${channel} provider is configured for this environment`);
    }
  });

  it("selects the SMTP email adapter when smtpUrl is configured", () => {
    const repo = stubRepo();
    const registry = new NotificationProviderRegistry({
      notificationRepo: repo,
      smtpUrl: "smtp://localhost:1025",
    });
    const email = registry.get("email");
    expect(email.channel).toBe("email");
    expect(email.constructor.name).toBe("EmailNotificationProvider");
  });
});

describe("InAppNotificationProvider", () => {
  it("skips persistence for placeholder recipients and reports advisory-only", async () => {
    const repo = stubRepo();
    const provider = new InAppNotificationProvider(repo);
    const result = await provider.send(
      outbound({ userId: PLACEHOLDER_USER_ID }),
    );

    expect(result.delivered).toBe(false);
    expect(result.reason).toContain("placeholder recipient");
    expect(repo.create).not.toHaveBeenCalled();
  });
});