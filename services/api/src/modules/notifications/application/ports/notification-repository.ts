import type { Notification, NotificationListQuery } from "@netram/types";

export interface NotificationListFilter extends NotificationListQuery {
  userId: string;
  page: number;
  pageSize: number;
}

export interface NotificationRepositoryPort {
  listByUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: Notification[]; total: number; unread: number }>;
  findById(id: string): Promise<Notification | null>;
  markRead(userId: string, id: string): Promise<Notification | null>;
  markAllRead(userId: string): Promise<number>;
  create(cmd: {
    userId: string;
    type: string;
    title: string;
    body?: string | null;
  }): Promise<Notification>;
}
