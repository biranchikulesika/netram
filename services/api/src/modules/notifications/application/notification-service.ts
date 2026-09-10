import { AppError } from "../../../infrastructure/errors.js";
import type { AuthorizationService } from "../../authorization/application/authorization-service.js";
import type { RequestUserContext } from "../../../infrastructure/request-context.js";
import type { Notification, NotificationListQuery, NotificationListResponse } from "@netram/types";
import type { NotificationRepositoryPort } from "./ports/notification-repository.js";
import type {
  NotificationChannel,
  NotificationProviderPort,
  OutboundNotification,
} from "./ports/notification-provider-port.js";

const READ = "notification:read" as const;

export interface NotificationServiceDeps {
  repository: NotificationRepositoryPort;
  authz: AuthorizationService;
  providers?: NotificationProviderPort[];
}

export class NotificationService {
  private readonly repository: NotificationRepositoryPort;
  private readonly authz: AuthorizationService;
  private readonly providers: NotificationChannel[];

  constructor(deps: NotificationServiceDeps) {
    this.repository = deps.repository;
    this.authz = deps.authz;
    this.providers = (deps.providers ?? []).map((p) => p.channel);
  }

  async listNotifications(
    ctx: RequestUserContext,
    query: NotificationListQuery,
  ): Promise<NotificationListResponse> {
    this.authz.requirePermission(ctx, READ);
    const pageNum = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const page = await this.repository.listByUser(ctx.userId, pageNum, pageSize);
    return { ...page, page: pageNum, pageSize };
  }

  async markRead(ctx: RequestUserContext, id: string): Promise<Notification> {
    this.authz.requirePermission(ctx, READ);
    const updated = await this.repository.markRead(ctx.userId, id);
    if (!updated) throw AppError.notFound("Notification not found.");
    return updated;
  }

  async markAllRead(ctx: RequestUserContext): Promise<{ updated: number }> {
    this.authz.requirePermission(ctx, READ);
    const updated = await this.repository.markAllRead(ctx.userId);
    return { updated };
  }

  /** Emit a notification through all configured channels. Called by application services. */
  async emit(notification: OutboundNotification): Promise<void> {
    // persist to in_app channel if configured
    if (this.providers.includes("in_app")) {
      await this.repository.create({
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
      });
    }
  }
}
